import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { memberAccessLevels, organizationRoles } from "../schema";

type Ctx = QueryCtx | MutationCtx;

export type OrganizationRole = Infer<typeof organizationRoles>;
export type MemberAccess = Infer<typeof memberAccessLevels>;

/**
 * The permission matrix of the whole app lives in this module.
 *
 * Two orthogonal axes, resolved once per request:
 *
 * - **role** — `owner` / `admin` manage the organization, `member` does not.
 * - **access** — `full` sees every project in the organization (including ones
 *   created later), `limited` sees only the projects it was explicitly invited
 *   to, listed in `projectMembers`.
 *
 * Queries fail soft on `null`; mutations go through the `require*` helpers,
 * which throw Czech messages meant for a toast.
 */

export type OrgAccess = {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  membershipId: Id<"organizationMembers">;
  role: OrganizationRole;
  access: MemberAccess;
};

export type ProjectAccess = {
  project: Doc<"projects">;
  org: OrgAccess;
};

const MANAGER_ROLES: readonly OrganizationRole[] = ["owner", "admin"];

/** Membership of `userId` in `organizationId`, or null when there is none. */
export async function getOrgAccess(
  ctx: Ctx,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
): Promise<OrgAccess | null> {
  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org_user", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId),
    )
    .unique();
  if (!membership) {
    return null;
  }
  return {
    organizationId,
    userId,
    membershipId: membership._id,
    role: membership.role,
    access: membership.access,
  };
}

/** Owner and admin manage the organization: settings, members, invites. */
export function canManageOrg(access: OrgAccess | null): boolean {
  return access !== null && MANAGER_ROLES.includes(access.role);
}

export function isOwner(access: OrgAccess | null): boolean {
  return access?.role === "owner";
}

/**
 * Only a member who sees the whole organization may create a project — a
 * `limited` member would immediately lose sight of what they just created.
 */
export function canCreateProject(access: OrgAccess | null): boolean {
  return access?.access === "full";
}

/** Project access for `userId`, or null when the project is invisible to them. */
export async function getProjectAccess(
  ctx: Ctx,
  userId: Id<"users">,
  projectId: Id<"projects">,
): Promise<ProjectAccess | null> {
  const project = await ctx.db.get(projectId);
  if (!project) {
    return null;
  }
  const org = await getOrgAccess(ctx, userId, project.organizationId);
  if (!org) {
    return null;
  }
  if (org.access === "limited") {
    const grant = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", projectId).eq("userId", userId),
      )
      .unique();
    if (!grant) {
      return null;
    }
  }
  return { project, org };
}

/** Renaming, archiving, icons and project invites are manager-only. */
export function canManageProject(access: ProjectAccess | null): boolean {
  return access !== null && canManageOrg(access.org);
}

/**
 * Projects visible to `userId` in `organizationId`, archived ones excluded.
 * This is what the sidebar renders, so it must stay a single indexed read plus
 * at most one `get` per explicit grant.
 */
export async function listVisibleProjects(
  ctx: Ctx,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
): Promise<Doc<"projects">[]> {
  const org = await getOrgAccess(ctx, userId, organizationId);
  if (!org) {
    return [];
  }

  if (org.access === "full") {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .collect();
    return projects.filter((project) => !project.archived);
  }

  const grants = await ctx.db
    .query("projectMembers")
    .withIndex("by_org_user", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId),
    )
    .collect();
  const projects = await Promise.all(
    grants.map((grant) => ctx.db.get(grant.projectId)),
  );
  return projects.filter(
    (project): project is Doc<"projects"> =>
      project !== null &&
      project.organizationId === organizationId &&
      !project.archived,
  );
}

export async function requireOrgAccess(
  ctx: Ctx,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
): Promise<OrgAccess> {
  const access = await getOrgAccess(ctx, userId, organizationId);
  if (!access) {
    throw new Error("Nemáte přístup k této organizaci.");
  }
  return access;
}

export async function requireOrgManager(
  ctx: Ctx,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
): Promise<OrgAccess> {
  const access = await requireOrgAccess(ctx, userId, organizationId);
  if (!canManageOrg(access)) {
    throw new Error("Na tuto akci nemáte oprávnění.");
  }
  return access;
}

export async function requireProjectAccess(
  ctx: Ctx,
  userId: Id<"users">,
  projectId: Id<"projects">,
): Promise<ProjectAccess> {
  const access = await getProjectAccess(ctx, userId, projectId);
  if (!access) {
    throw new Error("Nemáte přístup k tomuto projektu.");
  }
  return access;
}

export async function requireProjectManager(
  ctx: Ctx,
  userId: Id<"users">,
  projectId: Id<"projects">,
): Promise<ProjectAccess> {
  const access = await requireProjectAccess(ctx, userId, projectId);
  if (!canManageProject(access)) {
    throw new Error("Na tuto akci nemáte oprávnění.");
  }
  return access;
}
