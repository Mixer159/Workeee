import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getProjectAccess } from "./access";
import { commentBodyText, parseCommentBody } from "./commentBody";
import {
  categoryOf,
  pushNotificationItem,
  rank,
  type NotificationKind,
} from "./notificationItems";
import { listProjectMemberIds } from "./projectMembers";

/**
 * Notification batching.
 *
 * The rule the product asked for: eight tasks added in one sitting must arrive
 * as **one** e-mail, not eight. So nothing is ever sent from the mutation that
 * caused it. Each recipient gets a row in `notificationEvents`, and the first
 * of them opens a **window** — a single scheduled flush, recorded in
 * `notificationBatches`, that every further event of that burst rides along
 * with instead of scheduling its own.
 *
 * The window slides. Every new event pushes the send to `now + QUIET_MS`, so
 * the digest goes out once the person has actually stopped typing rather than
 * at a fixed time that happens to cut their burst in half. `MAX_WAIT_MS` is
 * what stops that from sliding forever when somebody spends the whole morning
 * on the board: past the cap the batch goes out and the next one starts.
 *
 * Nothing here is optimistic about the state at send time. `claimDigest`
 * re-reads every task and re-checks project access, because between the
 * enqueue and the flush a task can be deleted, a project can be archived and a
 * member can be removed from the organization — and an e-mail is the one part
 * of this app that cannot be un-shown.
 */

/** Wait this long after the last task before sending. */
export const QUIET_MS = 2 * 60 * 1000;

/** But never hold a batch longer than this after its first task. */
export const MAX_WAIT_MS = 10 * 60 * 1000;

/**
 * Events claimed by one flush. A burst bigger than this is spilled into a
 * follow-up e-mail rather than growing the transaction without a bound.
 */
export const MAX_EVENTS_PER_DIGEST = 100;

/** Longest quoted piece of a comment. A notification is a nudge, not the thread. */
export const MAX_PREVIEW_LENGTH = 140;

/**
 * One compact, plain-text line from a stored comment body.
 *
 * Notifications and the workspace both show the same preview, so the segment
 * parsing, mention rendering and truncation live here rather than drifting
 * into two almost-identical helpers.
 */
export function commentBodyPreview(body: string): string {
  const segments = parseCommentBody(body);
  if (!segments) {
    return "";
  }
  const text = commentBodyText(segments).replace(/\s+/g, " ").trim();
  if (text.length <= MAX_PREVIEW_LENGTH) {
    return text;
  }
  return `${text.slice(0, MAX_PREVIEW_LENGTH - 1).trimEnd()}…`;
}

// The category and rank rules live in `./notificationItems.ts` — the feed and
// this queue collapse events the same way, and one of them has to own the rule.

export type DigestTaskItem = {
  type: "task";
  taskId: Id<"tasks">;
  projectId: Id<"projects">;
  title: string;
  kind: "task_created" | "task_assigned";
  actorName: string;
};

export type DigestCommentItem = {
  type: "comment";
  taskId: Id<"tasks">;
  projectId: Id<"projects">;
  title: string;
  kind: "comment_added" | "comment_mention";
  actorName: string;
  /** How many comments this one line stands for. */
  count: number;
  /** The quoted text, already trimmed. Empty when the comment is gone. */
  preview: string;
};

export type DigestItem = DigestTaskItem | DigestCommentItem;

export type DigestProject = {
  projectId: Id<"projects">;
  projectName: string;
  items: DigestItem[];
};

export type Digest = {
  email: string;
  name: string;
  projects: DigestProject[];
  /** Items, not events — ten comments on one task are one item. */
  total: number;
  taskCount: number;
  commentCount: number;
};

/**
 * Is this person subscribed? A missing row means yes — see the schema comment
 * on `notificationSettings`.
 */
export async function wantsTaskEmails(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const row = await ctx.db
    .query("notificationSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return row?.taskEmails ?? true;
}

/**
 * A new task on the board: everyone who can open the project hears about it,
 * except the person who just typed it.
 *
 * Each `notify*` writes both channels — the in-app feed row first (it takes no
 * switch into account), then the e-mail queue, which `enqueue` filters by the
 * personal switch. One audience computation, two deliveries.
 */
export async function notifyTaskCreated(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  actorId: Id<"users">,
): Promise<void> {
  const recipients = [
    ...(await listProjectMemberIds(ctx, task.projectId, task.organizationId)),
  ];
  await pushNotificationItem(ctx, recipients, task, actorId, "task_created");
  await enqueue(ctx, recipients, task, actorId, "task_created");
}

/** A task handed to somebody. Only the new řešitel, and never for oneself. */
export async function notifyTaskAssigned(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  actorId: Id<"users">,
  assigneeId: Id<"users">,
): Promise<void> {
  await pushNotificationItem(ctx, [assigneeId], task, actorId, "task_assigned");
  await enqueue(ctx, [assigneeId], task, actorId, "task_assigned");
}

/**
 * A comment under a task.
 *
 * Deliberately **not** everybody who can see the project: comments outnumber
 * tasks by an order of magnitude, and a lively thread under one task would
 * otherwise mail the whole team all afternoon. Two people hear about it —
 * whoever the comment `@`-mentions, and the task's řešitel, because it is
 * their task being talked about. Anyone else is pulled in with a mention,
 * which is what mentions are for.
 */
export async function notifyComment(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  commentId: Id<"comments">,
  mentionedIds: Id<"users">[],
  actorId: Id<"users">,
): Promise<void> {
  const mentioned = new Set(mentionedIds);
  await pushNotificationItem(
    ctx,
    mentioned,
    task,
    actorId,
    "comment_mention",
    commentId,
  );
  await enqueue(ctx, [...mentioned], task, actorId, "comment_mention", commentId);

  // The řešitel hears about it too — unless they were mentioned, in which case
  // they already have the stronger of the two.
  if (task.assigneeId && !mentioned.has(task.assigneeId)) {
    await pushNotificationItem(
      ctx,
      [task.assigneeId],
      task,
      actorId,
      "comment_added",
      commentId,
    );
    await enqueue(
      ctx,
      [task.assigneeId],
      task,
      actorId,
      "comment_added",
      commentId,
    );
  }
}

async function enqueue(
  ctx: MutationCtx,
  recipients: Id<"users">[],
  task: Doc<"tasks">,
  actorId: Id<"users">,
  kind: NotificationKind,
  commentId?: Id<"comments">,
): Promise<void> {
  if (recipients.length === 0) {
    return;
  }
  const category = categoryOf(kind);

  // Everything already waiting for this task, so a task that is created and
  // then assigned inside one window produces one line in the e-mail, not two —
  // and so does a task somebody wrote under ten times.
  const pending = await ctx.db
    .query("notificationEvents")
    .withIndex("by_task", (q) => q.eq("taskId", task._id))
    .collect();

  for (const userId of recipients) {
    if (userId === actorId) {
      continue;
    }
    if (!(await wantsTaskEmails(ctx, userId))) {
      continue;
    }

    const existing = pending.find(
      (event) =>
        event.userId === userId && categoryOf(event.kind) === category,
    );
    if (existing) {
      await ctx.db.patch(existing._id, mergeInto(existing, kind, actorId, commentId));
      await scheduleFlush(ctx, userId);
      continue;
    }

    await ctx.db.insert("notificationEvents", {
      userId,
      organizationId: task.organizationId,
      projectId: task.projectId,
      taskId: task._id,
      kind,
      actorId,
      commentId,
      count: category === "comment" ? 1 : undefined,
    });
    await scheduleFlush(ctx, userId);
  }
}

/**
 * Fold a new event into the one already waiting.
 *
 * The count always grows — ten replies are ten replies. What is quoted only
 * moves when the new event is at least as strong: being mentioned and then
 * buried under unrelated chatter should still show the sentence that named
 * you, not the last thing anybody happened to type.
 */
function mergeInto(
  existing: Doc<"notificationEvents">,
  kind: NotificationKind,
  actorId: Id<"users">,
  commentId?: Id<"comments">,
): Partial<Doc<"notificationEvents">> {
  const patch: Partial<Doc<"notificationEvents">> = {};

  if (categoryOf(kind) === "comment") {
    patch.count = (existing.count ?? 1) + 1;
  }
  if (rank(kind) >= rank(existing.kind)) {
    patch.kind = kind;
    patch.actorId = actorId;
    if (commentId) {
      patch.commentId = commentId;
    }
  }
  return patch;
}

/**
 * Open the window, or push the one that is already open further out.
 *
 * `flushAt` only ever moves forward, and never past `firstEventAt + MAX_WAIT_MS`.
 */
export async function scheduleFlush(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const now = Date.now();
  const open = await ctx.db
    .query("notificationBatches")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  if (!open) {
    const flushAt = now + QUIET_MS;
    const scheduledId = await ctx.scheduler.runAt(
      flushAt,
      internal.notifications.flush,
      { userId },
    );
    await ctx.db.insert("notificationBatches", {
      userId,
      scheduledId,
      firstEventAt: now,
      flushAt,
    });
    return;
  }

  const flushAt = Math.min(now + QUIET_MS, open.firstEventAt + MAX_WAIT_MS);
  if (flushAt <= open.flushAt) {
    // Already due at or before this — the cap has been reached, or two events
    // landed in the same millisecond. Leave the schedule alone.
    return;
  }
  await ctx.scheduler.cancel(open.scheduledId);
  const scheduledId = await ctx.scheduler.runAt(
    flushAt,
    internal.notifications.flush,
    { userId },
  );
  await ctx.db.patch(open._id, { scheduledId, flushAt });
}

/**
 * Take one person's pending events off the queue and turn them into the digest
 * to send, or `null` when there is nothing left worth sending.
 *
 * **Claim first, send second.** The rows are deleted inside this transaction,
 * before the e-mail leaves, so a flush that dies mid-send loses a notification
 * rather than delivering it twice. For an e-mail that is the right way round.
 */
export async function claimDigest(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Digest | null> {
  const open = await ctx.db
    .query("notificationBatches")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (open) {
    await ctx.db.delete(open._id);
  }

  const events = await ctx.db
    .query("notificationEvents")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX_EVENTS_PER_DIGEST);
  await Promise.all(events.map((event) => ctx.db.delete(event._id)));

  // A burst bigger than one claim: open a fresh window for the remainder rather
  // than growing this transaction.
  if (events.length === MAX_EVENTS_PER_DIGEST) {
    await scheduleFlush(ctx, userId);
  }

  if (events.length === 0) {
    return null;
  }

  const user = await ctx.db.get(userId);
  if (!user || !(await wantsTaskEmails(ctx, userId))) {
    // Deleted, or switched the notifications off while the window was open.
    return null;
  }

  const projects = new Map<Id<"projects">, DigestProject | null>();
  const actors = new Map<Id<"users">, string>();
  const items: DigestItem[] = [];

  for (const event of events) {
    if (!projects.has(event.projectId)) {
      // The access re-check. Removed from the organization, or the grant
      // revoked, and this project silently stops being in the e-mail.
      const access = await getProjectAccess(ctx, userId, event.projectId);
      projects.set(
        event.projectId,
        access
          ? {
              projectId: event.projectId,
              projectName: access.project.name,
              items: [],
            }
          : null,
      );
    }
    const project = projects.get(event.projectId);
    if (!project) {
      continue;
    }

    const task = await ctx.db.get(event.taskId);
    if (!task) {
      // Created and deleted inside the window. Nothing to link to.
      continue;
    }

    if (!actors.has(event.actorId)) {
      const actor = await ctx.db.get(event.actorId);
      actors.set(event.actorId, actor?.name ?? "Někdo");
    }
    const actorName = actors.get(event.actorId)!;

    if (categoryOf(event.kind) === "task") {
      const item: DigestTaskItem = {
        type: "task",
        taskId: task._id,
        projectId: event.projectId,
        title: task.title,
        kind: event.kind as DigestTaskItem["kind"],
        actorName,
      };
      project.items.push(item);
      items.push(item);
      continue;
    }

    const count = event.count ?? 1;
    const preview = event.commentId
      ? await commentPreview(ctx, event.commentId)
      : null;
    if (preview === null && count === 1) {
      // The only comment this line stood for has been deleted since. There is
      // nothing left to tell them about.
      continue;
    }

    const item: DigestCommentItem = {
      type: "comment",
      taskId: task._id,
      projectId: event.projectId,
      title: task.title,
      kind: event.kind as DigestCommentItem["kind"],
      actorName,
      count,
      preview: preview ?? "",
    };
    project.items.push(item);
    items.push(item);
  }

  if (items.length === 0) {
    return null;
  }

  return {
    email: user.email,
    name: user.name,
    projects: [...projects.values()]
      .filter(
        (project): project is DigestProject =>
          project !== null && project.items.length > 0,
      )
      // Tasks before comments inside a project: the thing that appeared reads
      // ahead of the talk about it.
      .map((project) => ({
        ...project,
        items: [
          ...project.items.filter((item) => item.type === "task"),
          ...project.items.filter((item) => item.type === "comment"),
        ],
      })),
    total: items.length,
    taskCount: items.filter((item) => item.type === "task").length,
    commentCount: items.filter((item) => item.type === "comment").length,
  };
}

/**
 * The quoted line under a comment notification, or `null` when the comment has
 * been deleted since it was queued. Shared by the e-mail digest and the in-app
 * feed (`convex/notificationItems.ts`), so the two quote identically.
 *
 * The body is a segment array, so this goes through the shared codec rather
 * than through the raw JSON — a mention reads as `@Jméno`, which is how it was
 * written.
 */
export async function commentPreview(
  ctx: QueryCtx | MutationCtx,
  commentId: Id<"comments">,
): Promise<string | null> {
  const comment = await ctx.db.get(commentId);
  if (!comment) {
    return null;
  }
  return commentBodyPreview(comment.body);
}

/**
 * Drop whatever is still queued for a task. Called from `deleteTaskChildren`,
 * so both `tasks.remove` and the organization purge sweep the queue with
 * everything else that hangs off a task.
 */
export async function deleteTaskNotifications(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
): Promise<number> {
  const events = await ctx.db
    .query("notificationEvents")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .collect();
  await Promise.all(events.map((event) => ctx.db.delete(event._id)));
  return events.length;
}
