import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** A useful reaction set without letting one comment turn into an emoji wall. */
export const MAX_COMMENT_REACTION_TYPES = 20;

type Ctx = QueryCtx | MutationCtx;

export async function listCommentReactions(
  ctx: Ctx,
  commentId: Id<"comments">,
): Promise<Doc<"commentReactions">[]> {
  return await ctx.db
    .query("commentReactions")
    .withIndex("by_comment", (q) => q.eq("commentId", commentId))
    .take(MAX_COMMENT_REACTION_TYPES);
}

export async function deleteCommentReactions(
  ctx: MutationCtx,
  commentId: Id<"comments">,
): Promise<number> {
  const reactions = await listCommentReactions(ctx, commentId);
  await Promise.all(reactions.map((reaction) => ctx.db.delete(reaction._id)));
  return reactions.length;
}

/** The task-wide index keeps comment stream reads and task deletion bounded. */
export async function listTaskReactions(
  ctx: Ctx,
  taskId: Id<"tasks">,
): Promise<Doc<"commentReactions">[]> {
  return await ctx.db
    .query("commentReactions")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .take(200 * MAX_COMMENT_REACTION_TYPES);
}
