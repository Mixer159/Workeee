import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { logActivity } from "./lib/activity";
import {
  canManageOrg,
  getOrgAccess,
  isOwner,
  requireOrgAccess,
  requireOrgManager,
} from "./lib/access";
import { getAuthUserId } from "./lib/auth";
import { isSameName, normalizeName } from "./lib/validation";
import { organizationRoles } from "./schema";

/**
 * Create an organization. The creator becomes its owner with full access, so a
 * brand-new organization always has exactly one manager who can see everything.
 */
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const name = normalizeName(args.name, "organizace");

    const organizationId = await ctx.db.insert("organizations", {
      name,
      createdBy: userId,
    });
    await ctx.db.insert("organizationMembers", {
      organizationId,
      userId,
      role: "owner",
      access: "full",
    });
    await logActivity(ctx, {
      organizationId,
      actorId: userId,
      type: "organization_created",
      targetId: organizationId,
      meta: { name },
    });

    return { organizationId };
  },
});

/**
 * Every organization the signed-in user belongs to. Held open by the app shell
 * on every page, so it stays free of counts and joins beyond the org document.
 */
export const listForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const rows = await Promise.all(
      memberships.map(async (membership) => {
        const organization = await ctx.db.get(membership.organizationId);
        if (!organization) {
          return null;
        }
        return {
          _id: organization._id,
          name: organization.name,
          role: membership.role,
          access: membership.access,
        };
      }),
    );
    return rows
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => a.name.localeCompare(b.name, "cs"));
  },
});

export const get = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const access = await getOrgAccess(ctx, userId, args.organizationId);
    if (!access) {
      return null;
    }
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      return null;
    }
    return {
      _id: organization._id,
      name: organization.name,
      role: access.role,
      access: access.access,
      canManage: canManageOrg(access),
      canDelete: isOwner(access),
    };
  },
});

export const rename = mutation({
  args: { organizationId: v.id("organizations"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    await requireOrgManager(ctx, userId, args.organizationId);
    const name = normalizeName(args.name, "organizace");

    await ctx.db.patch(args.organizationId, { name });
    await logActivity(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      type: "organization_renamed",
      targetId: args.organizationId,
      meta: { name },
    });
  },
});

/**
 * Delete an organization with everything in it.
 *
 * Owner-only, and confirmed by typing the name: this is the one action in the
 * app that cannot be undone. An admin may run the organization, but ending it is
 * the owner's call.
 *
 * This transaction deletes exactly the two tables that are a way in —
 * memberships, which every read and write in the app authorizes through, and
 * invites, the only public entry point. Both are bounded by the size of the
 * team, so they always fit in one transaction, and once they are gone the
 * organization is unreachable for everybody, its owner included.
 *
 * The contents — projects, boards, tasks, bodies, files and their blobs,
 * comments, the audit trail — are unbounded and therefore swept up in the
 * background by `internal.organizationPurge.purge`, which spends a fixed budget
 * per run and reschedules itself. Nothing is audited: `activityLogs` is scoped
 * by organization, so a row written here would be deleted seconds later by the
 * purge that carries the rest of them away.
 */
export const remove = mutation({
  args: { organizationId: v.id("organizations"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const access = await requireOrgAccess(ctx, userId, args.organizationId);
    if (!isOwner(access)) {
      throw new Error("Organizaci může smazat jen její vlastník.");
    }
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new Error("Organizace už neexistuje.");
    }
    if (!isSameName(args.name, organization.name)) {
      throw new Error("Název organizace nesouhlasí.");
    }

    const [memberships, invites] = await Promise.all([
      ctx.db
        .query("organizationMembers")
        .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
        .collect(),
      ctx.db
        .query("invites")
        .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
        .collect(),
    ]);
    await Promise.all([
      ...memberships.map((membership) => ctx.db.delete(membership._id)),
      ...invites.map((invite) => ctx.db.delete(invite._id)),
    ]);

    await ctx.scheduler.runAfter(0, internal.organizationPurge.purge, {
      organizationId: args.organizationId,
    });
  },
});

/**
 * The member list. Any member may see who else is in the organization; only
 * managers see which projects a `limited` member was invited to.
 */
export const members = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const viewer = await getOrgAccess(ctx, userId, args.organizationId);
    if (!viewer) {
      return [];
    }
    const showProjects = canManageOrg(viewer);

    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const rows = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        if (!user) {
          return null;
        }
        let projects: { _id: Id<"projects">; name: string }[] = [];
        if (showProjects && membership.access === "limited") {
          const grants = await ctx.db
            .query("projectMembers")
            .withIndex("by_org_user", (q) =>
              q
                .eq("organizationId", args.organizationId)
                .eq("userId", membership.userId),
            )
            .collect();
          const granted = await Promise.all(
            grants.map((grant) => ctx.db.get(grant.projectId)),
          );
          projects = granted
            .filter((project) => project !== null)
            .map((project) => ({ _id: project._id, name: project.name }));
        }
        return {
          membershipId: membership._id,
          userId: membership.userId,
          name: user.name,
          email: user.email,
          image: user.image,
          role: membership.role,
          access: membership.access,
          projects,
        };
      }),
    );

    return rows
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => a.name.localeCompare(b.name, "cs"));
  },
});

/**
 * Change a member's organization role.
 *
 * Guards: only an owner may touch an owner or hand out the owner role, and the
 * last owner can never be demoted — an organization without an owner cannot be
 * repaired from the UI.
 */
export const updateMemberRole = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: organizationRoles,
  },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) {
      throw new Error("Nejste přihlášeni.");
    }
    const actor = await requireOrgManager(ctx, actorId, args.organizationId);
    const target = await requireOrgAccess(ctx, args.userId, args.organizationId);

    if (target.role === args.role) {
      return;
    }
    if (actor.role !== "owner" && (target.role === "owner" || args.role === "owner")) {
      throw new Error("Roli vlastníka může měnit jen vlastník.");
    }
    if (target.role === "owner" && (await isLastOwner(ctx, args.organizationId))) {
      throw new Error("Organizace musí mít aspoň jednoho vlastníka.");
    }

    await ctx.db.patch(target.membershipId, { role: args.role });
    await logActivity(ctx, {
      organizationId: args.organizationId,
      actorId,
      type: "member_role_changed",
      targetId: args.userId,
      meta: { from: target.role, to: args.role },
    });
  },
});

/**
 * Remove a member. Their explicit project grants go with them, otherwise a
 * re-invited user would silently regain the old project list.
 */
export const removeMember = mutation({
  args: { organizationId: v.id("organizations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) {
      throw new Error("Nejste přihlášeni.");
    }
    const actor = await requireOrgManager(ctx, actorId, args.organizationId);
    const target = await requireOrgAccess(ctx, args.userId, args.organizationId);

    if (target.role === "owner" && actor.role !== "owner") {
      throw new Error("Vlastníka může odebrat jen jiný vlastník.");
    }
    if (target.role === "owner" && (await isLastOwner(ctx, args.organizationId))) {
      throw new Error("Organizace musí mít aspoň jednoho vlastníka.");
    }

    const grants = await ctx.db
      .query("projectMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId),
      )
      .collect();
    await Promise.all(grants.map((grant) => ctx.db.delete(grant._id)));
    await ctx.db.delete(target.membershipId);

    await logActivity(ctx, {
      organizationId: args.organizationId,
      actorId,
      type: "member_removed",
      targetId: args.userId,
      meta: { role: target.role },
    });
  },
});

/** True when demoting or removing this organization's owner would leave none. */
async function isLastOwner(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
): Promise<boolean> {
  const memberships = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .collect();
  return memberships.filter((membership) => membership.role === "owner").length <= 1;
}
