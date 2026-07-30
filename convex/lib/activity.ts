import type { Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { activityTypes } from "../schema";

export type ActivityType = Infer<typeof activityTypes>;

/**
 * Append an entry to the audit trail.
 *
 * Only server code calls this — the `type` union is never taken from client
 * arguments, so an audit entry cannot be forged. Logging is best-effort in the
 * sense that it never changes the outcome of the action it records, but it runs
 * inside the same transaction, so a failed mutation leaves no orphan entry.
 */
export async function logActivity(
  ctx: MutationCtx,
  entry: {
    organizationId: Id<"organizations">;
    actorId: Id<"users">;
    type: ActivityType;
    targetId?: string;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  await ctx.db.insert("activityLogs", {
    organizationId: entry.organizationId,
    actorId: entry.actorId,
    type: entry.type,
    targetId: entry.targetId,
    meta: entry.meta,
  });
}
