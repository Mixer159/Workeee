import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

/**
 * Resolve the app user document for a Better Auth user id.
 */
export async function getUserByAuthId(
  ctx: Ctx,
  authId: string,
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", authId))
    .unique();
}

/**
 * The current app user, or null when unauthenticated.
 *
 * `identity.subject` is the Better Auth user id, so this is a single indexed
 * read — no round trip into the auth component.
 */
export async function getAuthUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  return await getUserByAuthId(ctx, identity.subject);
}

/**
 * The current app user id, or null when unauthenticated.
 *
 * Every public Convex function starts here. Queries fail soft on null,
 * mutations throw a Czech error message.
 */
export async function getAuthUserId(ctx: Ctx): Promise<Id<"users"> | null> {
  const user = await getAuthUser(ctx);
  return user?._id ?? null;
}
