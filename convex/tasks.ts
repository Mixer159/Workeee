import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { canManageProject, getProjectAccess } from "./lib/access";
import { logActivity } from "./lib/activity";
import { getAuthUserId } from "./lib/auth";
import { byOrder } from "./lib/ordering";
import { touchActive } from "./lib/presence";
import {
  assignTask,
  createTask,
  moveTask,
  renameTask,
} from "./lib/taskActions";
import { deleteTaskChildren, requireTaskAccess } from "./lib/tasks";
import { listProjectStatuses } from "./lib/taskStatuses";

/**
 * The whole board in one query: every task of the project with the display
 * fields a card needs, ordered by column and then by position inside it.
 *
 * Assignees are resolved here, once per distinct person — a card must never
 * open its own query for the avatar next to the title.
 */
export const listByProject = query({
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

    const [statuses, tasks] = await Promise.all([
      listProjectStatuses(ctx, args.projectId),
      ctx.db
        .query("tasks")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
    ]);

    const statusOrder = new Map(
      statuses.map((status, index) => [status._id, index]),
    );
    const people = await loadPeople(
      ctx,
      tasks.map((task) => task.assigneeId),
    );

    return tasks
      .sort(
        (a, b) =>
          (statusOrder.get(a.statusId) ?? Number.MAX_SAFE_INTEGER) -
            (statusOrder.get(b.statusId) ?? Number.MAX_SAFE_INTEGER) ||
          byOrder(a, b),
      )
      .map((task) => ({
        _id: task._id,
        title: task.title,
        statusId: task.statusId,
        order: task.order,
        assignee: task.assigneeId ? (people.get(task.assigneeId) ?? null) : null,
      }));
  },
});

/**
 * One task for the detail page. `taskId` comes from the URL, so it is a plain
 * string normalized through `normalizeId` — a hand-edited address must produce
 * an empty screen, not an argument-validation error.
 */
export const get = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const taskId = ctx.db.normalizeId("tasks", args.taskId);
    if (!taskId) {
      return null;
    }
    const task = await ctx.db.get(taskId);
    if (!task) {
      return null;
    }
    const access = await getProjectAccess(ctx, userId, task.projectId);
    if (!access) {
      return null;
    }

    const [status, creator, assignee] = await Promise.all([
      ctx.db.get(task.statusId),
      ctx.db.get(task.createdBy),
      task.assigneeId ? ctx.db.get(task.assigneeId) : Promise.resolve(null),
    ]);

    return {
      _id: task._id,
      projectId: task.projectId,
      projectName: access.project.name,
      organizationId: task.organizationId,
      title: task.title,
      statusId: task.statusId,
      statusName: status?.name ?? null,
      statusColor: status?.color ?? null,
      assignee: assignee ? person(assignee) : null,
      createdBy: creator ? person(creator) : null,
      createdAt: task._creationTime,
      updatedAt: task.updatedAt,
      canRemove: task.createdBy === userId || canManageProject(access),
    };
  },
});

// The writes themselves live in `convex/lib/taskActions.ts`, shared with the
// MCP tools a bot calls — these mutations only decide who the actor is.

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    statusId: v.id("taskStatuses"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const taskId = await createTask(ctx, userId, args);
    return { taskId };
  },
});

export const updateTitle = mutation({
  args: { taskId: v.id("tasks"), title: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    await renameTask(ctx, userId, args);
  },
});

/** Assign or unassign; the assignee must be able to open the project. */
export const setAssignee = mutation({
  args: {
    taskId: v.id("tasks"),
    assigneeId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    await assignTask(ctx, userId, args);
  },
});

/** Drag & drop: the client sends the neighbours, never an order number. */
export const move = mutation({
  args: {
    taskId: v.id("tasks"),
    statusId: v.id("taskStatuses"),
    previousTaskId: v.optional(v.id("tasks")),
    nextTaskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    await moveTask(ctx, userId, args);
  },
});

/** Only the person who created the task, or a project manager, may delete it. */
export const remove = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const { task, access } = await requireTaskAccess(ctx, userId, args.taskId);
    if (task.createdBy !== userId && !canManageProject(access)) {
      throw new Error("Úkol může smazat jen jeho autor nebo správce projektu.");
    }
    await touchActive(ctx, userId);

    await deleteTaskChildren(ctx, task._id);
    await ctx.db.delete(task._id);
    await logActivity(ctx, {
      organizationId: access.project.organizationId,
      actorId: userId,
      type: "task_deleted",
      targetId: task._id,
      meta: { title: task.title, projectId: task.projectId },
    });
  },
});

type Person = {
  _id: Id<"users">;
  name: string;
  image: string | undefined;
};

function person(user: Doc<"users">): Person {
  return { _id: user._id, name: user.name, image: user.image };
}

/** One read per distinct assignee, not one per card. */
async function loadPeople(
  ctx: QueryCtx | MutationCtx,
  ids: (Id<"users"> | undefined)[],
): Promise<Map<Id<"users">, Person>> {
  const distinct = [...new Set(ids.filter((id): id is Id<"users"> => !!id))];
  const users = await Promise.all(distinct.map((id) => ctx.db.get(id)));
  const people = new Map<Id<"users">, Person>();
  for (const user of users) {
    if (user) {
      people.set(user._id, person(user));
    }
  }
  return people;
}
