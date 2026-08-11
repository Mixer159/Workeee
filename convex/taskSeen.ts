import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getProjectAccess, listVisibleProjects } from "./lib/access";
import { getAuthUserId } from "./lib/auth";
import { markTaskItemsRead } from "./lib/notificationItems";
import { listProjectUnread, markTaskSeen } from "./lib/taskSeen";
import { requireTaskAccess } from "./lib/tasks";

/**
 * Read state. The drawer calls `markSeen` while a task is open; the board and
 * the rail count what is newer than everyone's last visit. See
 * `convex/lib/taskSeen.ts` for the rules of what counts as unread.
 */

/**
 * "I am looking at this task." Upserts the visit and settles the feed rows the
 * bell still shows about it — one call clears every badge the task carries.
 */
export const markSeen = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const { task } = await requireTaskAccess(ctx, userId, args.taskId);
    await markTaskSeen(ctx, userId, task);
    await markTaskItemsRead(ctx, userId, task._id);
  },
});

/**
 * The board's badges: every task of the project with unread comments or never
 * opened at all. Tasks with nothing new are not in the answer.
 */
export const unreadByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const access = await getProjectAccess(ctx, userId, args.projectId);
    if (!access) {
      return [];
    }
    return await listProjectUnread(ctx, userId, args.projectId);
  },
});

/**
 * The rail's badges: for every visible project, how many of its tasks carry
 * something unseen. Projects with nothing new are not in the answer, so a
 * quiet organization costs one row read per project.
 */
export const unreadByOrganization = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const projects = await listVisibleProjects(ctx, userId, args.organizationId);
    const entries = await Promise.all(
      projects.map(async (project) => ({
        projectId: project._id,
        count: (await listProjectUnread(ctx, userId, project._id)).length,
      })),
    );
    return entries.filter((entry) => entry.count > 0);
  },
});
