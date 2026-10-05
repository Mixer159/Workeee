import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { canManageProject } from "./lib/access";
import { getAuthUserId } from "./lib/auth";
import {
  createComment,
  MAX_COMMENTS,
  validateCommentBody,
} from "./lib/commentActions";
import { parseCommentBody, serializeCommentBody } from "./lib/commentBody";
import {
  deleteCommentReactions,
  listTaskReactions,
} from "./lib/commentReactions";
import { deleteFile, isImageMimeType } from "./lib/files";
import { touchActive } from "./lib/presence";
import { getTaskAccess, requireTaskAccess, touchTask } from "./lib/tasks";

/**
 * The comment stream under a task.
 *
 * `body` is a serialized segment array (`convex/lib/commentBody.ts`). The client
 * builds it, the server re-parses it and re-checks every mention against the
 * people who can actually open the project — a mention is a reference to a user
 * id, so it must never name somebody who is not there.
 */

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

    const [authors, reactions] = await Promise.all([
      loadAuthors(ctx, comments),
      listTaskReactions(ctx, args.taskId),
    ]);
    const reactionsByComment = new Map<
      Id<"comments">,
      { emoji: string; count: number; reactedByMe: boolean }[]
    >();
    for (const reaction of reactions) {
      if (reaction.userIds.length === 0) {
        continue;
      }
      const group = reactionsByComment.get(reaction.commentId) ?? [];
      group.push({
        emoji: reaction.emoji,
        count: reaction.userIds.length,
        reactedByMe: reaction.userIds.includes(userId),
      });
      reactionsByComment.set(reaction.commentId, group);
    }

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
        reactions: reactionsByComment.get(comment._id) ?? [],
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
    // Shared with the bot's `add_comment` — see `convex/lib/commentActions.ts`.
    const commentId = await createComment(ctx, userId, args);
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
    await touchActive(ctx, userId);

    const segments = await validateCommentBody(ctx, access, args.body, {
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
    await touchActive(ctx, userId);

    const attachments = await ctx.db
      .query("files")
      .withIndex("by_comment", (q) => q.eq("commentId", comment._id))
      .collect();
    await Promise.all(attachments.map((file) => deleteFile(ctx, file)));
    await deleteCommentReactions(ctx, comment._id);
    await ctx.db.delete(comment._id);
    await touchTask(ctx, task._id);
  },
});

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
