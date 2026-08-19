import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "./lib/auth";
import {
  listCommentReactions,
  MAX_COMMENT_REACTION_TYPES,
} from "./lib/commentReactions";
import { touchActive } from "./lib/presence";
import { requireTaskAccess, touchTask } from "./lib/tasks";
import { normalizeReactionEmoji } from "./lib/validation";

/** Add the caller to an emoji aggregate, or remove them when already present. */
export const toggle = mutation({
  args: {
    commentId: v.id("comments"),
    emoji: v.string(),
  },
  returns: v.object({ active: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Tento komentář už neexistuje.");
    }
    const { task } = await requireTaskAccess(ctx, userId, comment.taskId);
    await touchActive(ctx, userId);
    const emoji = normalizeReactionEmoji(args.emoji);
    const existing = await ctx.db
      .query("commentReactions")
      .withIndex("by_comment_emoji", (q) =>
        q.eq("commentId", comment._id).eq("emoji", emoji),
      )
      .unique();

    if (existing) {
      if (existing.userIds.includes(userId)) {
        const userIds = existing.userIds.filter((id) => id !== userId);
        if (userIds.length === 0) {
          await ctx.db.delete(existing._id);
        } else {
          await ctx.db.patch(existing._id, { userIds });
        }
        await touchTask(ctx, task._id);
        return { active: false };
      }

      await ctx.db.patch(existing._id, {
        userIds: [...existing.userIds, userId],
      });
      await touchTask(ctx, task._id);
      return { active: true };
    }

    const reactions = await listCommentReactions(ctx, comment._id);
    if (reactions.length >= MAX_COMMENT_REACTION_TYPES) {
      throw new Error("Komentář může mít nejvýš 20 různých reakcí.");
    }

    await ctx.db.insert("commentReactions", {
      taskId: comment.taskId,
      commentId: comment._id,
      projectId: comment.projectId,
      organizationId: comment.organizationId,
      emoji,
      userIds: [userId],
    });
    await touchTask(ctx, task._id);
    return { active: true };
  },
});
