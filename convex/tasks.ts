import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { canManageProject, getProjectAccess, requireProjectAccess } from "./lib/access";
import { logActivity } from "./lib/activity";
import { getAuthUserId } from "./lib/auth";
import { notifyTaskAssigned, notifyTaskCreated } from "./lib/notifications";
import { appendOrder, byOrder, orderBetween, renumber } from "./lib/ordering";
import { touchActive } from "./lib/presence";
import { deleteTaskChildren, requireTaskAccess } from "./lib/tasks";
import { listProjectStatuses } from "./lib/taskStatuses";
import { normalizeTitle } from "./lib/validation";

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
    const { project } = await requireProjectAccess(ctx, userId, args.projectId);
    await touchActive(ctx, userId);
    const title = normalizeTitle(args.title);
    const status = await requireStatusOfProject(
      ctx,
      args.statusId,
      args.projectId,
    );

    const siblings = await tasksInStatus(ctx, status._id);
    const taskId = await ctx.db.insert("tasks", {
      projectId: args.projectId,
      organizationId: project.organizationId,
      title,
      statusId: status._id,
      order: appendOrder(siblings),
      createdBy: userId,
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      organizationId: project.organizationId,
      actorId: userId,
      type: "task_created",
      targetId: taskId,
      meta: { title, projectId: args.projectId },
    });

    // Queued, never sent from here: eight tasks typed in a row have to arrive
    // as one e-mail. See `convex/lib/notifications.ts`.
    const task = await ctx.db.get(taskId);
    if (task) {
      await notifyTaskCreated(ctx, task, userId);
    }

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
    const { task } = await requireTaskAccess(ctx, userId, args.taskId);
    await touchActive(ctx, userId);
    const title = normalizeTitle(args.title);
    if (title === task.title) {
      return;
    }
    await ctx.db.patch(task._id, { title, updatedAt: Date.now() });
  },
});

/**
 * Assign or unassign. The assignee must be able to open the project — a task
 * parked on someone who cannot see it is invisible work.
 */
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
    const { task } = await requireTaskAccess(ctx, userId, args.taskId);
    await touchActive(ctx, userId);

    if (args.assigneeId) {
      const assigneeAccess = await getProjectAccess(
        ctx,
        args.assigneeId,
        task.projectId,
      );
      if (!assigneeAccess) {
        throw new Error("Tento člověk nemá přístup k projektu.");
      }
    }
    await ctx.db.patch(task._id, {
      assigneeId: args.assigneeId,
      updatedAt: Date.now(),
    });

    // Only a real handover is worth an e-mail: re-picking the same person, or
    // taking the task yourself, tells nobody anything.
    if (args.assigneeId && args.assigneeId !== task.assigneeId) {
      await notifyTaskAssigned(ctx, task, userId, args.assigneeId);
    }
  },
});

/**
 * Drag & drop, within a column and across columns.
 *
 * The client sends the two tasks the card lands between — never an order
 * number. The server reads their current positions, so two people dragging into
 * the same column at the same time both get a sane result instead of one
 * silently overwriting the other's numbering.
 */
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
    const { task, access } = await requireTaskAccess(ctx, userId, args.taskId);
    await touchActive(ctx, userId);
    const status = await requireStatusOfProject(
      ctx,
      args.statusId,
      task.projectId,
    );

    const order = await placeTask(ctx, task, status._id, {
      previousTaskId: args.previousTaskId,
      nextTaskId: args.nextTaskId,
    });
    await ctx.db.patch(task._id, {
      statusId: status._id,
      order,
      updatedAt: Date.now(),
    });

    if (task.statusId !== status._id) {
      const from = await ctx.db.get(task.statusId);
      await logActivity(ctx, {
        organizationId: access.project.organizationId,
        actorId: userId,
        type: "task_status_changed",
        targetId: task._id,
        meta: { from: from?.name ?? null, to: status.name },
      });
    }
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

/**
 * The order a card gets in `statusId`, renumbering the column first when the
 * neighbours have been halved so close together that a midpoint is no longer
 * safe. Both neighbours missing means "append at the end".
 */
async function placeTask(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  statusId: Id<"taskStatuses">,
  neighbours: {
    previousTaskId?: Id<"tasks">;
    nextTaskId?: Id<"tasks">;
  },
): Promise<number> {
  const siblings = (await tasksInStatus(ctx, statusId)).filter(
    (sibling) => sibling._id !== task._id,
  );

  const previousIndex = neighbours.previousTaskId
    ? siblings.findIndex((s) => s._id === neighbours.previousTaskId)
    : -1;
  const nextIndex = neighbours.nextTaskId
    ? siblings.findIndex((s) => s._id === neighbours.nextTaskId)
    : -1;

  let index: number;
  if (previousIndex >= 0) {
    index = previousIndex + 1;
  } else if (nextIndex >= 0) {
    index = nextIndex;
  } else {
    index = siblings.length;
  }

  const order = orderBetween(
    siblings[index - 1]?.order ?? null,
    siblings[index]?.order ?? null,
  );
  if (order !== null) {
    return order;
  }

  // The gap ran out. Renumber the column and drop the card into the slot.
  const orders = renumber(siblings.length + 1);
  await Promise.all(
    siblings.map((sibling, position) =>
      ctx.db.patch(sibling._id, {
        order: orders[position < index ? position : position + 1],
      }),
    ),
  );
  return orders[index];
}

async function requireStatusOfProject(
  ctx: MutationCtx,
  statusId: Id<"taskStatuses">,
  projectId: Id<"projects">,
): Promise<Doc<"taskStatuses">> {
  const status = await ctx.db.get(statusId);
  if (!status || status.projectId !== projectId) {
    throw new Error("Tento stav nepatří do tohoto projektu.");
  }
  return status;
}

async function tasksInStatus(ctx: MutationCtx, statusId: Id<"taskStatuses">) {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_status", (q) => q.eq("statusId", statusId))
    .collect();
  return tasks.sort(byOrder);
}

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
