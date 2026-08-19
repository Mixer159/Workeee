import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  canCreateProject,
  canManageProject,
  getProjectAccess,
  listVisibleProjects,
  requireOrgAccess,
  requireProjectManager,
} from "./lib/access";
import { logActivity } from "./lib/activity";
import { getAuthUserId } from "./lib/auth";
import { baseMimeType } from "./lib/files";
import { touchActive } from "./lib/presence";
import { listProjectMemberIds } from "./lib/projectMembers";
import {
  deleteStorageIfUnreferenced,
  isStorageIdReferenced,
} from "./lib/storage";
import { sanitizeIconSvg, svgDataUrl } from "./lib/svg";
import { seedProjectStatuses } from "./lib/taskStatuses";
import { normalizeEmoji, normalizeName } from "./lib/validation";

/** Project icons are small square images shown at 20 px in the sidebar. */
const MAX_ICON_BYTES = 2 * 1024 * 1024;

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    // An emoji picked in the create dialog. An uploaded image cannot be part of
    // this mutation — the upload URL is authorized against a project that does
    // not exist yet — so the dialog creates the project first and then follows
    // the ordinary `generateUploadUrl` → `setIcon` path.
    emoji: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const access = await requireOrgAccess(ctx, userId, args.organizationId);
    if (!canCreateProject(access)) {
      throw new Error("Projekt může založit jen člen s přístupem k celé organizaci.");
    }
    await touchActive(ctx, userId);
    const name = normalizeName(args.name, "projektu");
    const emoji = args.emoji ? normalizeEmoji(args.emoji) : undefined;

    const projectId = await ctx.db.insert("projects", {
      organizationId: args.organizationId,
      name,
      emoji,
      createdBy: userId,
    });
    // A board with no columns cannot take a task, so the three core statuses
    // are part of creating a project, not a later setup step.
    await seedProjectStatuses(ctx, projectId, args.organizationId);
    await logActivity(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      type: "project_created",
      targetId: projectId,
      meta: { name },
    });

    return { projectId };
  },
});

/**
 * The sidebar list: only projects this user may see, archived ones excluded.
 * Subscribed to on every page — keep it to the indexed read in `access.ts`.
 */
export const listVisible = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const projects = await listVisibleProjects(ctx, userId, args.organizationId);
    const rows = await Promise.all(
      projects.map(async (project) => ({
        _id: project._id,
        name: project.name,
        emoji: project.emoji ?? null,
        iconUrl: await iconUrl(ctx, project),
      })),
    );
    return rows.sort((a, b) => a.name.localeCompare(b.name, "cs"));
  },
});

/**
 * One project, or null when it does not exist or is invisible to this user.
 *
 * `projectId` arrives from the URL, so it is a plain string normalized through
 * `normalizeId` — a hand-edited address must produce an empty screen, not an
 * argument-validation error.
 */
export const get = query({
  args: { projectId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const projectId = ctx.db.normalizeId("projects", args.projectId);
    if (!projectId) {
      return null;
    }
    const access = await getProjectAccess(ctx, userId, projectId);
    if (!access) {
      return null;
    }
    const { project } = access;
    return {
      _id: project._id,
      organizationId: project.organizationId,
      name: project.name,
      archived: project.archived === true,
      emoji: project.emoji ?? null,
      iconUrl: await iconUrl(ctx, project),
      canManage: canManageProject(access),
    };
  },
});

/**
 * Who a task in this project may be assigned to: the organization's `full`
 * members plus everyone with an explicit grant. A `limited` member of another
 * project is deliberately absent — assigning them a task they cannot open would
 * only produce a mutation that throws.
 */
export const assignableMembers = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const access = await getProjectAccess(ctx, userId, args.projectId);
    if (!access) {
      return [];
    }

    const memberIds = await listProjectMemberIds(
      ctx,
      args.projectId,
      access.project.organizationId,
    );

    const rows = await Promise.all(
      [...memberIds].map(async (memberId) => {
        const user = await ctx.db.get(memberId);
        return user
          ? {
              _id: user._id,
              name: user.name,
              email: user.email,
              image: user.image,
            }
          : null;
      }),
    );
    return rows
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => a.name.localeCompare(b.name, "cs"));
  },
});

export const rename = mutation({
  args: { projectId: v.id("projects"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const { project } = await requireProjectManager(ctx, userId, args.projectId);
    await touchActive(ctx, userId);
    const name = normalizeName(args.name, "projektu");

    await ctx.db.patch(args.projectId, { name });
    await logActivity(ctx, {
      organizationId: project.organizationId,
      actorId: userId,
      type: "project_renamed",
      targetId: args.projectId,
      meta: { from: project.name, to: name },
    });
  },
});

export const setArchived = mutation({
  args: { projectId: v.id("projects"), archived: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const { project } = await requireProjectManager(ctx, userId, args.projectId);
    await touchActive(ctx, userId);

    await ctx.db.patch(args.projectId, { archived: args.archived });
    await logActivity(ctx, {
      organizationId: project.organizationId,
      actorId: userId,
      type: args.archived ? "project_archived" : "project_restored",
      targetId: args.projectId,
      meta: { name: project.name },
    });
  },
});

/**
 * Upload target for a project icon. Authorized before the blob exists so an
 * outsider can never obtain a writable URL for this deployment's storage.
 */
export const generateUploadUrl = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    await requireProjectManager(ctx, userId, args.projectId);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Attach an uploaded blob as the project icon.
 *
 * The client's claim about the file is worth nothing, so the *stored* metadata
 * decides: anything that is not an image, or is over the size cap, is deleted
 * on the spot. The previous icon's blob is deleted too — nothing else points at
 * it.
 *
 * A rejection comes back as `{ ok: false, error }` rather than as a thrown
 * error: a Convex mutation is a transaction, so deleting the blob and then
 * throwing would roll the deletion back and leave the file in storage forever.
 * The client turns the result into the usual toast. The same rule governs
 * `files.register`.
 */
export const setIcon = mutation({
  args: { projectId: v.id("projects"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const { project } = await requireProjectManager(ctx, userId, args.projectId);
    if (
      await isStorageIdReferenced(ctx, args.storageId, {
        projectId: args.projectId,
      })
    ) {
      throw new Error("Tento obrázek už aplikace používá.");
    }

    const metadata = await ctx.db.system.get(args.storageId);
    if (!metadata) {
      throw new Error("Nahrání souboru se nepovedlo. Zkuste to prosím znovu.");
    }
    // Any raster image is welcome — PNG, JPG, WEBP, GIF and the `.ico` a
    // browser hands over as `image/x-icon` or `image/vnd.microsoft.icon`. SVG is
    // the one exception: it is an image that can carry script, and the icon is
    // served straight from storage — the same reason `convex/lib/files.ts`
    // blocklists it. The type is compared without its parameters, so
    // `image/svg+xml;charset=utf-8` cannot walk past the exclusion.
    const contentType = baseMimeType(metadata.contentType ?? "");
    if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
      await deleteStorageIfUnreferenced(ctx, args.storageId);
      return {
        ok: false as const,
        error: "Ikona musí být obrázek (PNG, JPG, WEBP, GIF nebo ICO).",
      };
    }
    if (metadata.size > MAX_ICON_BYTES) {
      await deleteStorageIfUnreferenced(ctx, args.storageId);
      return { ok: false as const, error: "Obrázek může mít nejvýš 2 MB." };
    }

    const previous = project.iconStorageId;
    // An upload, an SVG and an emoji are three answers to the same question, so
    // setting one drops the others instead of leaving a hidden second icon
    // behind.
    await ctx.db.patch(args.projectId, {
      iconStorageId: args.storageId,
      iconSvg: undefined,
      emoji: undefined,
    });
    await deleteIconBlob(ctx, previous, args.storageId);
    return { ok: true as const };
  },
});

/**
 * The SVG icon, which takes a different road from every other image in the app:
 * the markup travels as a mutation argument, is validated by
 * `convex/lib/svg.ts` and is stored **on the project document**, never as a
 * blob. `projects.get` then serves it as a `data:` URI.
 *
 * That is the whole security design, and it is why `setIcon` still refuses
 * `image/svg+xml` and always will. A blob has a URL; a URL can be opened; an
 * SVG opened as a page runs script on the storage origin. A `data:` URI has no
 * origin and browsers refuse to navigate to one, so the markup is only ever
 * pixels inside an `<img>`.
 *
 * It throws rather than returning a result — the `{ ok: false }` shape exists
 * only for mutations that have to delete a rejected blob before answering, and
 * a rejected SVG never became one.
 */
export const setSvgIcon = mutation({
  args: { projectId: v.id("projects"), svg: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const { project } = await requireProjectManager(ctx, userId, args.projectId);

    const result = sanitizeIconSvg(args.svg);
    if (!result.ok) {
      throw new Error(result.error);
    }

    await ctx.db.patch(args.projectId, {
      iconSvg: result.svg,
      iconStorageId: undefined,
      emoji: undefined,
    });
    await deleteIconBlob(ctx, project.iconStorageId, undefined);
  },
});

/** The third answer: an emoji replaces whichever image was there. */
export const setEmoji = mutation({
  args: { projectId: v.id("projects"), emoji: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const { project } = await requireProjectManager(ctx, userId, args.projectId);
    const emoji = normalizeEmoji(args.emoji);

    await ctx.db.patch(args.projectId, {
      emoji,
      iconStorageId: undefined,
      iconSvg: undefined,
    });
    await deleteIconBlob(ctx, project.iconStorageId, undefined);
  },
});

export const removeIcon = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const { project } = await requireProjectManager(ctx, userId, args.projectId);

    await ctx.db.patch(args.projectId, {
      iconStorageId: undefined,
      iconSvg: undefined,
      emoji: undefined,
    });
    await deleteIconBlob(ctx, project.iconStorageId, undefined);
  },
});

/**
 * The one address an icon is rendered from, whichever shape it was stored in: a
 * storage URL for an uploaded raster image, a `data:` URI for an SVG. The two
 * are exclusive, so the order here decides nothing.
 */
async function iconUrl(
  ctx: QueryCtx,
  project: Doc<"projects">,
): Promise<string | null> {
  if (project.iconStorageId) {
    return await ctx.storage.getUrl(project.iconStorageId);
  }
  return project.iconSvg ? svgDataUrl(project.iconSvg) : null;
}

async function deleteIconBlob(
  ctx: MutationCtx,
  previous: Id<"_storage"> | undefined,
  next: Id<"_storage"> | undefined,
): Promise<void> {
  if (!previous || previous === next) {
    return;
  }
  await deleteStorageIfUnreferenced(ctx, previous);
}
