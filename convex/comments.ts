import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { canManageProject, type ProjectAccess } from "./lib/access";
import { getAuthUserId } from "./lib/auth";
import {
  commentBodyText,
  compactCommentBody,
  MAX_COMMENT_LENGTH,
  mentionedUserIds,
  parseCommentBody,
  serializeCommentBody,
  type CommentSegment,
} from "./lib/commentBody";
import { deleteFile, isImageMimeType } from "./lib/files";
import { notifyComment } from "./lib/notifications";
import { listProjectMemberIds } from "./lib/projectMembers";
import { getTaskAccess, requireTaskAccess, touchTask } from "./lib/tasks";

/**
 * The comment stream under a task.
 *
 * `body` is a serialized segment array (`convex/lib/commentBody.ts`). The client
 * builds it, the server re-parses it and re-checks every mention against the
 * people who can actually open the project — a mention is a reference to a user
 * id, so it must never name somebody who is not there.
 */

/** A busy task; past this the stream needs its own paging screen, not a bigger cap. */
const MAX_COMMENTS = 200;

/** How many files one comment may carry. */
const MAX_COMMENT_ATTACHMENTS = 10;

export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const taskAccess = await getTaskAccess(ctx, userId, args.taskId);
    if (!taskAccess) {
      return [];
    }
    const manager = canManageProject(taskAccess.access);

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .take(MAX_COMMENTS);
    comments.sort((a, b) => a._creationTime - b._creationTime);

    const authors = await loadAuthors(ctx, comments);

    return await Promise.all(
      comments.map(async (comment) => ({
        _id: comment._id,
        author: authors.get(comment.authorId) ?? null,
        // A body that somehow failed to parse renders as nothing rather than
        // taking the whole stream down with it.
        body: parseCommentBody(comment.body) ?? [],
        attachments: await resolveAttachments(ctx, comment.attachmentIds),
        edited: comment.edited === true,
        createdAt: comment._creationTime,
        canEdit: comment.authorId === userId,
        canRemove: comment.authorId === userId || manager,
      })),
    );
  },
});

export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    body: v.string(),
    attachmentIds: v.optional(v.array(v.id("files"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const { task, access } = await requireTaskAccess(ctx, userId, args.taskId);

    const attachments = await claimableAttachments(
      ctx,
      task._id,
      userId,
      args.attachmentIds ?? [],
    );
    const segments = await validateBody(ctx, access, args.body, {
      allowEmpty: attachments.length > 0,
    });

    const commentId = await ctx.db.insert("comments", {
      taskId: task._id,
      projectId: task.projectId,
      organizationId: task.organizationId,
      authorId: userId,
      body: serializeCommentBody(segments),
      attachmentIds:
        attachments.length > 0
          ? attachments.map((file) => file._id)
          : undefined,
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
      userId,
    );

    return { commentId };
  },
});

/** Only the author rewrites their own words. Attachments are not editable. */
export const update = mutation({
  args: { commentId: v.id("comments"), body: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Tento komentář už neexistuje.");
    }
    const { task, access } = await requireTaskAccess(ctx, userId, comment.taskId);
    if (comment.authorId !== userId) {
      throw new Error("Komentář může upravit jen jeho autor.");
    }

    const segments = await validateBody(ctx, access, args.body, {
      allowEmpty: (comment.attachmentIds ?? []).length > 0,
    });
    await ctx.db.patch(comment._id, {
      body: serializeCommentBody(segments),
      edited: true,
    });
    await touchTask(ctx, task._id);
  },
});

/** Author or project manager. The comment's files go with it, blobs included. */
export const remove = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Tento komentář už neexistuje.");
    }
    const { task, access } = await requireTaskAccess(ctx, userId, comment.taskId);
    if (comment.authorId !== userId && !canManageProject(access)) {
      throw new Error("Komentář může smazat jen jeho autor nebo správce projektu.");
    }

    const attachments = await ctx.db
      .query("files")
      .withIndex("by_comment", (q) => q.eq("commentId", comment._id))
      .collect();
    await Promise.all(attachments.map((file) => deleteFile(ctx, file)));
    await ctx.db.delete(comment._id);
    await touchTask(ctx, task._id);
  },
});

/**
 * Re-parse the client's body and check every mention against the people who can
 * open this project. An unknown or non-member id is a rejection, not a silent
 * downgrade to plain text — the client picked it from `assignableMembers`, so
 * anything else arrived by hand.
 */
async function validateBody(
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

type Author = { _id: Id<"users">; name: string; image: string | undefined };

async function loadAuthors(
  ctx: QueryCtx | MutationCtx,
  comments: Doc<"comments">[],
): Promise<Map<Id<"users">, Author>> {
  const distinct = [...new Set(comments.map((comment) => comment.authorId))];
  const users = await Promise.all(distinct.map((id) => ctx.db.get(id)));
  const authors = new Map<Id<"users">, Author>();
  for (const user of users) {
    if (user) {
      authors.set(user._id, {
        _id: user._id,
        name: user.name,
        image: user.image,
      });
    }
  }
  return authors;
}

async function resolveAttachments(
  ctx: QueryCtx,
  attachmentIds: Id<"files">[] | undefined,
) {
  if (!attachmentIds || attachmentIds.length === 0) {
    return [];
  }
  const files = await Promise.all(attachmentIds.map((id) => ctx.db.get(id)));
  return await Promise.all(
    files
      .filter((file): file is Doc<"files"> => file !== null)
      .map(async (file) => ({
        _id: file._id,
        fileName: file.fileName,
        mimeType: file.mimeType,
        size: file.size,
        isImage: isImageMimeType(file.mimeType),
        url: await ctx.storage.getUrl(file.storageId),
      })),
  );
}
