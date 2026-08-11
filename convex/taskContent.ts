import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "./lib/auth";
import {
  MAX_TASK_CONTENT_BYTES,
  parseTaskContent,
} from "./lib/taskContent";
import { getTaskAccess, requireTaskAccess, touchTask } from "./lib/tasks";

/**
 * The task body: one BlockNote document per task.
 *
 * The server keeps the BlockNote JSON as a string, but validates the default
 * schema's structural envelope before persisting it. The same pure parser is
 * used by the client, so a malformed legacy row cannot take the task drawer
 * down while a direct mutation call cannot create another one.
 */

export const get = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const taskAccess = await getTaskAccess(ctx, userId, args.taskId);
    if (!taskAccess) {
      return null;
    }

    const row = await contentRow(ctx, args.taskId);
    return {
      content: row?.content ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  },
});

/**
 * Upsert the body. Project-member level, like every other edit on the board —
 * the description is a shared working surface, not a manager's field.
 */
export const save = mutation({
  args: { taskId: v.id("tasks"), content: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const { task } = await requireTaskAccess(ctx, userId, args.taskId);

    if (args.content.length > MAX_TASK_CONTENT_BYTES) {
      throw new Error("Popis je příliš dlouhý.");
    }
    if (parseTaskContent(args.content) === null) {
      throw new Error("Popis se nepovedlo uložit.");
    }

    const row = await contentRow(ctx, args.taskId);
    const now = Date.now();
    if (row) {
      await ctx.db.patch(row._id, {
        content: args.content,
        updatedBy: userId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("taskContent", {
        taskId: args.taskId,
        projectId: task.projectId,
        organizationId: task.organizationId,
        content: args.content,
        updatedBy: userId,
        updatedAt: now,
      });
    }
    await touchTask(ctx, task._id);
  },
});

async function contentRow(ctx: QueryCtx | MutationCtx, taskId: Id<"tasks">) {
  return await ctx.db
    .query("taskContent")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .unique();
}
