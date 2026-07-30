import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  canManageOrg,
  canManageProject,
  getOrgAccess,
  getProjectAccess,
  requireOrgManager,
  requireProjectManager,
} from "./lib/access";
import { logActivity } from "./lib/activity";
import { getAuthUserId } from "./lib/auth";
import {
  expiresAtFromPreset,
  generateInviteCode,
  inviteStatus,
} from "./lib/invites";
import { inviteExpiryPresets } from "./schema";

const CODE_ATTEMPTS = 8;
const LIST_LIMIT = 50;

/**
 * Create an invite.
 *
 * Without `projectId` it is an organization invite: accepting it grants `full`
 * access — every project, including ones created later. With `projectId` it is
 * a project invite: accepting it grants `limited` access plus that one project.
 * Both kinds are manager-only in v1.
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
    expiry: inviteExpiryPresets,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    if (args.projectId) {
      const { project } = await requireProjectManager(
        ctx,
        userId,
        args.projectId,
      );
      if (project.organizationId !== args.organizationId) {
        throw new Error("Projekt do této organizace nepatří.");
      }
    } else {
      await requireOrgManager(ctx, userId, args.organizationId);
    }

    const code = await uniqueCode(ctx);
    const inviteId = await ctx.db.insert("invites", {
      organizationId: args.organizationId,
      projectId: args.projectId,
      code,
      createdBy: userId,
      expiresAt: expiresAtFromPreset(args.expiry, Date.now()),
      usedCount: 0,
    });
    await logActivity(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      type: "invite_created",
      targetId: inviteId,
      meta: { projectId: args.projectId ?? null, expiry: args.expiry },
    });

    return { inviteId, code };
  },
});

/**
 * Invites of an organization, newest first. Managers only — the code is the
 * capability, so the list is as sensitive as the codes in it.
 *
 * With `projectId` the list contains that project's invites; without it, it
 * contains organization-wide invites only.
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    if (args.projectId) {
      const access = await getProjectAccess(ctx, userId, args.projectId);
      if (
        !access ||
        !canManageProject(access) ||
        access.project.organizationId !== args.organizationId
      ) {
        return [];
      }
    } else {
      const access = await getOrgAccess(ctx, userId, args.organizationId);
      if (!canManageOrg(access)) {
        return [];
      }
    }

    const invites = args.projectId
      ? await ctx.db
          .query("invites")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
          .order("desc")
          .take(LIST_LIMIT)
      : await ctx.db
          .query("invites")
          .withIndex("by_org_project", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("projectId", undefined),
          )
          .order("desc")
          .take(LIST_LIMIT);

    const now = Date.now();

    return await Promise.all(
      invites.map(async (invite) => {
        const project = invite.projectId
          ? await ctx.db.get(invite.projectId)
          : null;
        const creator = await ctx.db.get(invite.createdBy);
        return {
          _id: invite._id,
          code: invite.code,
          projectId: invite.projectId ?? null,
          projectName: project?.name ?? null,
          createdByName: creator?.name ?? null,
          createdAt: invite._creationTime,
          expiresAt: invite.expiresAt,
          usedCount: invite.usedCount,
          status: inviteStatus(invite, now),
        };
      }),
    );
  },
});

export const revoke = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new Error("Pozvánka neexistuje.");
    }
    if (invite.projectId) {
      const { project } = await requireProjectManager(
        ctx,
        userId,
        invite.projectId,
      );
      if (project.organizationId !== invite.organizationId) {
        throw new Error("Projekt do této organizace nepatří.");
      }
    } else {
      await requireOrgManager(ctx, userId, invite.organizationId);
    }

    await ctx.db.patch(invite._id, { revoked: true });
    await logActivity(ctx, {
      organizationId: invite.organizationId,
      actorId: userId,
      type: "invite_revoked",
      targetId: invite._id,
      meta: { projectId: invite.projectId ?? null },
    });
  },
});

/**
 * PUBLIC — the join page renders this before the visitor has an account.
 *
 * Returns display copy only: who invites whom, where, and whether the invite is
 * still usable. No ids leave this function; `accept` takes the code, so the
 * client never needs one.
 */
export const getByCode = query({
  args: { code: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      organizationName: v.string(),
      projectName: v.union(v.string(), v.null()),
      inviterName: v.union(v.string(), v.null()),
      expiresAt: v.number(),
      expired: v.boolean(),
      revoked: v.boolean(),
      used: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const invite = await findByCode(ctx, args.code);
    if (!invite) {
      return null;
    }
    const organization = await ctx.db.get(invite.organizationId);
    if (!organization) {
      return null;
    }
    const project = invite.projectId ? await ctx.db.get(invite.projectId) : null;
    const inviter = await ctx.db.get(invite.createdBy);
    const status = inviteStatus(invite, Date.now());

    return {
      organizationName: organization.name,
      projectName: project?.name ?? null,
      inviterName: inviter?.name ?? null,
      expiresAt: invite.expiresAt,
      expired: status === "expired",
      revoked: status === "revoked",
      used: status === "used",
    };
  },
});

/**
 * Redeem an invite. Idempotent: accepting one you already redeemed returns the
 * same destination instead of failing, so a bookmarked join link never dead-ends.
 *
 * An organization invite upgrades an existing membership to `full`. A project
 * invite never downgrades a `full` member — it only adds the project grant.
 */
export const accept = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const invite = await findByCode(ctx, args.code);
    if (!invite) {
      throw new Error("Pozvánka neexistuje.");
    }
    const projectId = invite.projectId;
    if (invite.acceptedBy === userId) {
      return {
        organizationId: invite.organizationId,
        projectId: projectId ?? null,
      };
    }
    const status = inviteStatus(invite, Date.now());
    if (status === "revoked") {
      throw new Error("Tato pozvánka byla zrušena.");
    }
    if (status === "used") {
      throw new Error("Tato pozvánka už byla použita.");
    }
    if (status === "expired") {
      throw new Error("Platnost pozvánky vypršela.");
    }

    if (projectId) {
      const project = await ctx.db.get(projectId);
      if (!project || project.organizationId !== invite.organizationId) {
        throw new Error("Projekt z pozvánky už neexistuje.");
      }
    }

    let changed = false;
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", invite.organizationId).eq("userId", userId),
      )
      .unique();

    if (!membership) {
      await ctx.db.insert("organizationMembers", {
        organizationId: invite.organizationId,
        userId,
        role: "member",
        access: projectId ? "limited" : "full",
      });
      changed = true;
    } else if (!projectId && membership.access !== "full") {
      await ctx.db.patch(membership._id, { access: "full" });
      changed = true;
    }

    if (projectId) {
      const grant = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) =>
          q.eq("projectId", projectId).eq("userId", userId),
        )
        .unique();
      if (!grant) {
        await ctx.db.insert("projectMembers", {
          projectId,
          userId,
          organizationId: invite.organizationId,
        });
        changed = true;
      }
    }

    // The first account consumes the bearer link even if it already had the
    // target access. A later call by the same account returns above; anybody
    // else gets the explicit "already used" error.
    await ctx.db.patch(invite._id, {
      usedCount: invite.usedCount + 1,
      acceptedBy: userId,
    });
    await logActivity(ctx, {
      organizationId: invite.organizationId,
      actorId: userId,
      type: "invite_accepted",
      targetId: invite._id,
      meta: { projectId: invite.projectId ?? null, grantedAccess: changed },
    });

    return {
      organizationId: invite.organizationId,
      projectId: projectId ?? null,
    };
  },
});

async function findByCode(
  ctx: QueryCtx | MutationCtx,
  code: string,
): Promise<Doc<"invites"> | null> {
  const normalized = code.trim().toUpperCase();
  if (normalized.length === 0) {
    return null;
  }
  return await ctx.db
    .query("invites")
    .withIndex("by_code", (q) => q.eq("code", normalized))
    .unique();
}

async function uniqueCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode();
    const existing = await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!existing) {
      return code;
    }
  }
  throw new Error("Pozvánku se nepodařilo vytvořit. Zkuste to prosím znovu.");
}
