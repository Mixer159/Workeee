import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "./lib/auth";
import { getTaskAccess, requireTaskAccess, touchTask } from "./lib/tasks";

/**
 * The task body: one BlockNote document per task.
 *
 * The server treats the document as an opaque string. It checks that the string
 * is JSON and that it is not absurdly large; it never walks the blocks. That
 * keeps the editor free to evolve its schema without a backend migration, and
 * the only thing that could hide inside the JSON — a storage URL — was already
 * handed out by an authorized `files.register` call.
 */

/** A megabyte of block JSON is a very long document; past that something is wrong. */
const MAX_CONTENT_BYTES = 1024 * 1024;

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

    if (args.content.length > MAX_CONTENT_BYTES) {
      throw new Error("Popis je příliš dlouhý.");
    }
    try {
      JSON.parse(args.content);
    } catch {
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
