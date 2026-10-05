import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getProjectAccess, requireProjectAccess } from "./access";
import { logActivity } from "./activity";
import { notifyTaskAssigned, notifyTaskCreated } from "./notifications";
import { appendOrder, byOrder, orderBetween, renumber } from "./ordering";
import { touchActive } from "./presence";
import { requireTaskAccess } from "./tasks";
import { normalizeTitle } from "./validation";

/**
 * The writes of the board, performed on behalf of `actorId`.
 *
 * Two callers and one implementation: the public mutations in `convex/tasks.ts`
 * pass the signed-in person, the MCP tools in `convex/mcpTools.ts` pass the
 * acting bot. Every authorization rule lives in here (through `./access.ts`),
 * so a bot can never take a road around a check the board takes.
 */

export async function createTask(
  ctx: MutationCtx,
  actorId: Id<"users">,
  args: {
    projectId: Id<"projects">;
    statusId: Id<"taskStatuses">;
    title: string;
  },
): Promise<Id<"tasks">> {
  const { project } = await requireProjectAccess(ctx, actorId, args.projectId);
  await touchActive(ctx, actorId);
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
    createdBy: actorId,
    updatedAt: Date.now(),
  });
  await logActivity(ctx, {
    organizationId: project.organizationId,
    actorId,
    type: "task_created",
    targetId: taskId,
    meta: { title, projectId: args.projectId },
  });

  // Queued, never sent from here: eight tasks typed in a row have to arrive
  // as one e-mail. See `./notifications.ts`.
  const task = await ctx.db.get(taskId);
  if (task) {
    await notifyTaskCreated(ctx, task, actorId);
  }
  return taskId;
}

export async function renameTask(
  ctx: MutationCtx,
  actorId: Id<"users">,
  args: { taskId: Id<"tasks">; title: string },
): Promise<void> {
  const { task } = await requireTaskAccess(ctx, actorId, args.taskId);
  await touchActive(ctx, actorId);
  const title = normalizeTitle(args.title);
  if (title === task.title) {
    return;
  }
  await ctx.db.patch(task._id, { title, updatedAt: Date.now() });
}

/**
 * Assign or unassign. The assignee must be able to open the project — a task
 * parked on someone who cannot see it is invisible work.
 */
export async function assignTask(
  ctx: MutationCtx,
  actorId: Id<"users">,
  args: { taskId: Id<"tasks">; assigneeId?: Id<"users"> },
): Promise<void> {
  const { task } = await requireTaskAccess(ctx, actorId, args.taskId);
  await touchActive(ctx, actorId);

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
    await notifyTaskAssigned(ctx, task, actorId, args.assigneeId);
  }
}

/**
 * Drag & drop, within a column and across columns.
 *
 * The caller sends the two tasks the card lands between — never an order
 * number. The server reads their current positions, so two people dragging into
 * the same column at the same time both get a sane result instead of one
 * silently overwriting the other's numbering.
 */
export async function moveTask(
  ctx: MutationCtx,
  actorId: Id<"users">,
  args: {
    taskId: Id<"tasks">;
    statusId: Id<"taskStatuses">;
    previousTaskId?: Id<"tasks">;
    nextTaskId?: Id<"tasks">;
  },
): Promise<void> {
  const { task, access } = await requireTaskAccess(ctx, actorId, args.taskId);
  await touchActive(ctx, actorId);
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
      actorId,
      type: "task_status_changed",
      targetId: task._id,
      meta: { from: from?.name ?? null, to: status.name },
    });
  }
}

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
