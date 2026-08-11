import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * The in-app notification feed — the second channel next to the e-mail queue in
 * `./notifications.ts`, written from the same `notify*` calls but with two
 * deliberate differences:
 *
 * - **It ignores the e-mail switch.** `notificationSettings.taskEmails` turns
 *   off e-mail, not being told; the feed inside the app costs nobody an inbox.
 * - **It is not drained.** The e-mail queue is claimed and deleted at flush; a
 *   feed row lives until the person opens the task (or "Označit vše za
 *   přečtené"), because "seen" is a fact about the reader, not about the send.
 *
 * The collapsing rule is shared with the queue — this module owns it and the
 * queue imports it, so the two channels can never disagree about what "one
 * row per person per task per category" means.
 */

export type NotificationKind = Doc<"notificationItems">["kind"];

/**
 * Which of the two queues a kind belongs to. One row per person per task per
 * category, so a comment never overwrites the task it was written under.
 */
export type NotificationCategory = "task" | "comment";

export function categoryOf(kind: NotificationKind): NotificationCategory {
  return kind === "task_created" || kind === "task_assigned"
    ? "task"
    : "comment";
}

/** Inside a category, the higher rank wins and keeps its own detail. */
export function rank(kind: NotificationKind): number {
  return kind === "task_assigned" || kind === "comment_mention" ? 1 : 0;
}

/**
 * Write one event into the feeds of `recipients` (the actor excluded — nobody
 * needs a bell about what they just did themselves).
 *
 * An existing row for the same task and category is **replaced, not patched**:
 * delete + insert gives the merged row a fresh `_creationTime`, which is what
 * bubbles it back to the top of the feed and what the list sorts by. If the
 * old row was still unread, the new one carries its count and the stronger
 * kind's detail forward; if it had been read, the burst it stood for is over
 * and the new row starts counting at one.
 */
export async function pushNotificationItem(
  ctx: MutationCtx,
  recipients: Iterable<Id<"users">>,
  task: Doc<"tasks">,
  actorId: Id<"users">,
  kind: NotificationKind,
  commentId?: Id<"comments">,
): Promise<void> {
  const category = categoryOf(kind);

  for (const userId of recipients) {
    if (userId === actorId) {
      continue;
    }

    const existing = (
      await ctx.db
        .query("notificationItems")
        .withIndex("by_user_task", (q) =>
          q.eq("userId", userId).eq("taskId", task._id),
        )
        .collect()
    ).find((item) => categoryOf(item.kind) === category);

    const next = {
      userId,
      organizationId: task.organizationId,
      projectId: task.projectId,
      taskId: task._id,
      kind,
      actorId,
      commentId,
      count: category === "comment" ? 1 : undefined,
    };

    if (existing) {
      await ctx.db.delete(existing._id);
      if (existing.readAt === undefined) {
        if (category === "comment") {
          next.count = (existing.count ?? 1) + 1;
        }
        if (rank(kind) < rank(existing.kind)) {
          // The row already says something stronger — being mentioned and then
          // buried under chatter must still read as the mention.
          next.kind = existing.kind;
          next.actorId = existing.actorId;
          next.commentId = existing.commentId ?? next.commentId;
        }
      }
    }

    await ctx.db.insert("notificationItems", next);
  }
}

/**
 * Opening a task settles its notifications: whatever the feed still holds about
 * it for this person is marked read. Called by `taskSeen.markSeen`, so the bell
 * and the board badges clear from the same visit.
 */
export async function markTaskItemsRead(
  ctx: MutationCtx,
  userId: Id<"users">,
  taskId: Id<"tasks">,
): Promise<void> {
  const items = await ctx.db
    .query("notificationItems")
    .withIndex("by_user_task", (q) =>
      q.eq("userId", userId).eq("taskId", taskId),
    )
    .collect();
  const now = Date.now();
  await Promise.all(
    items
      .filter((item) => item.readAt === undefined)
      .map((item) => ctx.db.patch(item._id, { readAt: now })),
  );
}

/**
 * Feed rows die with their task. Called from `deleteTaskChildren`, so both
 * `tasks.remove` and the organization purge sweep them with everything else.
 */
export async function deleteTaskNotificationItems(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
): Promise<number> {
  const items = await ctx.db
    .query("notificationItems")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .collect();
  await Promise.all(items.map((item) => ctx.db.delete(item._id)));
  return items.length;
}
