import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Read state, and the unread badges computed from it.
 *
 * One `taskSeen` row per person per task, holding when they last had it open in
 * the drawer. Everything shown as "unread" is **counted live** against that
 * timestamp — a comment is unread when it is newer than `lastSeenAt` and not
 * the reader's own, a task is new when there is no row at all and somebody else
 * created it. No counter is stored anywhere, so there is nothing to drift and
 * nothing to backfill; a missing row simply means "never opened".
 */

export type TaskUnread = {
  taskId: Id<"tasks">;
  /** Comments newer than the last visit, the reader's own not counted. */
  unreadComments: number;
  /** Never opened, and created by somebody else. */
  isNew: boolean;
};

/** Upsert the visit. `Date.now()` here, not on the client — clocks disagree. */
export async function markTaskSeen(
  ctx: MutationCtx,
  userId: Id<"users">,
  task: Doc<"tasks">,
): Promise<void> {
  const existing = await ctx.db
    .query("taskSeen")
    .withIndex("by_user_task", (q) =>
      q.eq("userId", userId).eq("taskId", task._id),
    )
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { lastSeenAt: Date.now() });
    return;
  }
  await ctx.db.insert("taskSeen", {
    userId,
    taskId: task._id,
    projectId: task.projectId,
    organizationId: task.organizationId,
    lastSeenAt: Date.now(),
  });
}

/**
 * Every task of the project with something the reader has not seen. Tasks with
 * nothing new are left out, so the board query stays proportional to what is
 * actually unread.
 *
 * The comment count is an indexed range per task — `by_task` plus the implicit
 * `_creationTime`, opened at `lastSeenAt` — and comments are capped at 200 per
 * task, so the read is bounded on both axes.
 */
export async function listProjectUnread(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  projectId: Id<"projects">,
): Promise<TaskUnread[]> {
  const [tasks, seenRows] = await Promise.all([
    ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect(),
    ctx.db
      .query("taskSeen")
      .withIndex("by_user_project", (q) =>
        q.eq("userId", userId).eq("projectId", projectId),
      )
      .collect(),
  ]);
  const seenAt = new Map(seenRows.map((row) => [row.taskId, row.lastSeenAt]));

  const entries = await Promise.all(
    tasks.map(async (task): Promise<TaskUnread> => {
      const lastSeenAt = seenAt.get(task._id);
      const newer = await ctx.db
        .query("comments")
        .withIndex("by_task", (q) =>
          lastSeenAt === undefined
            ? q.eq("taskId", task._id)
            : q.eq("taskId", task._id).gt("_creationTime", lastSeenAt),
        )
        .collect();
      return {
        taskId: task._id,
        unreadComments: newer.filter((comment) => comment.authorId !== userId)
          .length,
        isNew: lastSeenAt === undefined && task.createdBy !== userId,
      };
    }),
  );

  return entries.filter((entry) => entry.isNew || entry.unreadComments > 0);
}

/**
 * Read state dies with its task. Called from `deleteTaskChildren`, so both
 * `tasks.remove` and the organization purge sweep it with everything else.
 */
export async function deleteTaskSeenRows(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
): Promise<number> {
  const rows = await ctx.db
    .query("taskSeen")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .collect();
  await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
  return rows.length;
}
