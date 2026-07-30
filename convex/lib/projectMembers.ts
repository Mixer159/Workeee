import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Everyone who can open a project: the organization's `full` members plus
 * everyone holding an explicit `projectMembers` grant.
 *
 * This is the set `projects.assignableMembers` renders and the set a comment
 * mention is checked against — one definition, so the mention picker can never
 * offer somebody the server would then reject.
 */
export async function listProjectMemberIds(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  organizationId: Id<"organizations">,
): Promise<Set<Id<"users">>> {
  const [memberships, grants] = await Promise.all([
    ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .collect(),
    ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect(),
  ]);
  const granted = new Set(grants.map((grant) => grant.userId));

  return new Set(
    memberships
      .filter(
        (membership) =>
          membership.access === "full" || granted.has(membership.userId),
      )
      .map((membership) => membership.userId),
  );
}
