import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { ProjectAccess } from "./access";
import {
  commentBodyText,
  compactCommentBody,
  MAX_COMMENT_LENGTH,
  mentionedUserIds,
  parseCommentBody,
  serializeCommentBody,
  type CommentSegment,
} from "./commentBody";
import { notifyComment } from "./notifications";
import { touchActive } from "./presence";
import { listProjectMemberIds } from "./projectMembers";
import { requireTaskAccess, touchTask } from "./tasks";

/**
 * Writing a comment on behalf of `actorId` — the signed-in person from
 * `convex/comments.ts`, or the acting bot from `convex/mcpTools.ts`. One
 * implementation, so the caps, the mention check and the notification audience
 * are the same whoever types.
 */

/** A busy task; past this the stream needs its own paging screen, not a bigger cap. */
export const MAX_COMMENTS = 200;

/** How many files one comment may carry. */
const MAX_COMMENT_ATTACHMENTS = 10;

export async function createComment(
  ctx: MutationCtx,
  actorId: Id<"users">,
  args: {
    taskId: Id<"tasks">;
    body: string;
    attachmentIds?: Id<"files">[];
  },
): Promise<Id<"comments">> {
  const { task, access } = await requireTaskAccess(ctx, actorId, args.taskId);
  await touchActive(ctx, actorId);

  const existingComments = await ctx.db
    .query("comments")
    .withIndex("by_task", (q) => q.eq("taskId", task._id))
    .take(MAX_COMMENTS);
  if (existingComments.length >= MAX_COMMENTS) {
    throw new Error("Úkol může mít nejvýš 200 komentářů.");
  }

  const attachments = await claimableAttachments(
    ctx,
    task._id,
    actorId,
    args.attachmentIds ?? [],
  );
  const segments = await validateCommentBody(ctx, access, args.body, {
    allowEmpty: attachments.length > 0,
  });

  const commentId = await ctx.db.insert("comments", {
    taskId: task._id,
    projectId: task.projectId,
    organizationId: task.organizationId,
    authorId: actorId,
    body: serializeCommentBody(segments),
    attachmentIds:
      attachments.length > 0 ? attachments.map((file) => file._id) : undefined,
  });
  // Claiming the files is what stops the same upload being attached twice.
  await Promise.all(
    attachments.map((file) => ctx.db.patch(file._id, { commentId })),
  );
  await touchTask(ctx, task._id);

  // Queued, never sent from here — and only to the people it is actually
  // about: whoever it mentions, plus the task's řešitel.
  await notifyComment(
    ctx,
    task,
    commentId,
    mentionedUserIds(segments),
    actorId,
  );

  return commentId;
}

/**
 * Re-parse the caller's body and check every mention against the people who can
 * open this project. An unknown or non-member id is a rejection, not a silent
 * downgrade to plain text — the client picked it from `assignableMembers`, so
 * anything else arrived by hand.
 */
export async function validateCommentBody(
  ctx: MutationCtx,
  access: ProjectAccess,
  raw: string,
  options: { allowEmpty: boolean },
): Promise<CommentSegment[]> {
  const parsed = parseCommentBody(raw);
  if (!parsed) {
    throw new Error("Komentář se nepovedlo uložit.");
  }
  const segments = compactCommentBody(parsed);

  const text = commentBodyText(segments).trim();
  if (text.length === 0 && !options.allowEmpty) {
    throw new Error("Napište komentář.");
  }
  if (text.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Komentář může mít nejvýš ${MAX_COMMENT_LENGTH} znaků.`);
  }

  const mentioned = mentionedUserIds(segments);
  if (mentioned.length > 0) {
    const memberIds = await listProjectMemberIds(
      ctx,
      access.project._id,
      access.project.organizationId,
    );
    for (const mentionId of mentioned) {
      if (!memberIds.has(mentionId)) {
        throw new Error("Zmíněný člověk nemá přístup k tomuto projektu.");
      }
    }
  }

  return segments;
}

/**
 * The files a new comment may claim: uploaded by this author, to this task, in
 * the comment composer, and not already spoken for by an earlier comment.
 */
async function claimableAttachments(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  userId: Id<"users">,
  attachmentIds: Id<"files">[],
): Promise<Doc<"files">[]> {
  if (attachmentIds.length === 0) {
    return [];
  }
  if (attachmentIds.length > MAX_COMMENT_ATTACHMENTS) {
    throw new Error(
      `Ke komentáři jde připojit nejvýš ${MAX_COMMENT_ATTACHMENTS} souborů.`,
    );
  }

  const distinct = [...new Set(attachmentIds)];
  const files = await Promise.all(distinct.map((id) => ctx.db.get(id)));

  return files.map((file) => {
    if (
      !file ||
      file.taskId !== taskId ||
      file.uploadedBy !== userId ||
      file.context !== "comment" ||
      file.commentId !== undefined
    ) {
      throw new Error("Přílohu komentáře se nepovedlo připojit.");
    }
    return file;
  });
}
