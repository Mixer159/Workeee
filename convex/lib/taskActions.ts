import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  canManageProject,
  getProjectAccess,
  requireProjectAccess,
} from "./access";
import { logActivity } from "./activity";
import { deleteUserTaskNotificationItems } from "./notificationItems";
import {
  deleteTaskNotificationsFor,
  notifyTaskAssigned,
  notifyTaskCreated,
} from "./notifications";
import { appendOrder, byOrder, orderBetween, renumber } from "./ordering";
import { touchActive } from "./presence";
import { listProjectMemberIds } from "./projectMembers";
import { deleteUserTaskSeen } from "./taskSeen";
import { requireTaskAccess } from "./tasks";
import {
  checkInitialHiddenFrom,
  effectiveHiddenIds,
  isTaskHiddenFromUser,
  MAX_HIDDEN_PER_TASK,
} from "./taskVisibility";
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
    /**
     * Hidden from these people from the first moment. Passing it here rather
     * than hiding right after creating is the point: in between, the title
     * would already be on their screen and a feed row in their bell.
     */
    hiddenFrom?: Id<"users">[];
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
  const hiddenFrom = await checkInitialHiddenFrom(ctx, {
    projectId: args.projectId,
    organizationId: project.organizationId,
    authorId: actorId,
    requested: args.hiddenFrom,
  });

  const siblings = await tasksInStatus(ctx, status._id);
  const taskId = await ctx.db.insert("tasks", {
    projectId: args.projectId,
    organizationId: project.organizationId,
    title,
    statusId: status._id,
    order: appendOrder(siblings),
    createdBy: actorId,
    updatedAt: Date.now(),
    hiddenFrom,
  });
  await logActivity(ctx, {
    organizationId: project.organizationId,
    actorId,
    type: "task_created",
    targetId: taskId,
    meta: { title, projectId: args.projectId },
  });

  // Queued, never sent from here: eight tasks typed in a row have to arrive
  // as one e-mail. See `./notifications.ts`. Nobody it is hidden from gets
  // the feed row.
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
 * Assign or unassign. The assignee must be able to open the project and must
 * not be somebody the task is hidden from — a task parked on someone who
 * cannot see it is invisible work, and the assignment e-mail would name it.
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
    if (await isTaskHiddenFromUser(ctx, task, args.assigneeId)) {
      throw new Error("Před tímto člověkem je úkol skrytý.");
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
 * Hide the task from one person, or show it to them again.
 *
 * One person per call, never "here is the whole list": two managers editing at
 * once would otherwise have the later write silently un-hide whoever the
 * earlier one just hid. Each call is idempotent.
 *
 * Only the author and project managers decide — the same people who may
 * delete the task, because hiding it from somebody deletes it for them.
 * Three people can never be hidden, each because the task would lose
 * somebody it cannot work without: the caller (they would lock themselves
 * out mid-click), the author, and the řešitel. A bot counts with its owner.
 *
 * Hiding also clears what is already on its way to them: the queued e-mail
 * rows, the feed rows and their read state of the task.
 */
export async function setTaskHiddenFrom(
  ctx: MutationCtx,
  actorId: Id<"users">,
  args: { taskId: Id<"tasks">; userId: Id<"users">; hidden: boolean },
): Promise<void> {
  const { task, access } = await requireTaskAccess(ctx, actorId, args.taskId);
  if (task.createdBy !== actorId && !canManageProject(access)) {
    throw new Error(
      "Viditelnost úkolu mění jen jeho autor nebo správce projektu.",
    );
  }
  await touchActive(ctx, actorId);

  const current = task.hiddenFrom ?? [];
  const listed = current.includes(args.userId);
  if (listed === args.hidden) {
    return;
  }

  if (!args.hidden) {
    const next = current.filter((userId) => userId !== args.userId);
    await ctx.db.patch(task._id, {
      hiddenFrom: next.length > 0 ? next : undefined,
    });
    await logVisibility(ctx, task, actorId, args.userId, false);
    return;
  }

  if (args.userId === actorId) {
    throw new Error("Sami před sebou úkol skrýt nemůžete.");
  }
  if (args.userId === task.createdBy) {
    throw new Error("Před autorem úkolu ho skrýt nejde.");
  }
  if (args.userId === task.assigneeId) {
    throw new Error(
      "Před řešitelem úkol skrýt nejde. Nejdřív ho přiřaďte někomu jinému.",
    );
  }
  if (current.length >= MAX_HIDDEN_PER_TASK) {
    throw new Error(
      `Úkol jde skrýt nejvýš před ${MAX_HIDDEN_PER_TASK} lidmi.`,
    );
  }
  const members = await listProjectMemberIds(
    ctx,
    task.projectId,
    task.organizationId,
  );
  if (!members.has(args.userId)) {
    throw new Error("Tento člověk nemá přístup k projektu.");
  }

  const next = [...current, args.userId];
  const before = await effectiveHiddenIds(ctx, current);
  const after = await effectiveHiddenIds(ctx, next);
  // The bot case: hiding a person hides their bots, and one of those may be
  // the author, the řešitel or — never through the UI, but still — the caller.
  if (after.has(actorId)) {
    throw new Error("Sami před sebou úkol skrýt nemůžete.");
  }
  if (after.has(task.createdBy)) {
    throw new Error("Autorem úkolu je bot tohoto člověka. Před ním úkol skrýt nejde.");
  }
  if (task.assigneeId && after.has(task.assigneeId)) {
    throw new Error(
      "Řešitelem úkolu je bot tohoto člověka. Nejdřív úkol přiřaďte někomu jinému.",
    );
  }

  await ctx.db.patch(task._id, { hiddenFrom: next });

  const newlyHidden = new Set(
    [...after].filter((userId) => !before.has(userId)),
  );
  await deleteTaskNotificationsFor(ctx, task._id, newlyHidden);
  for (const userId of newlyHidden) {
    await deleteUserTaskNotificationItems(ctx, userId, task._id);
    await deleteUserTaskSeen(ctx, userId, task._id);
  }
  await logVisibility(ctx, task, actorId, args.userId, true);
}

async function logVisibility(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  actorId: Id<"users">,
  userId: Id<"users">,
  hidden: boolean,
): Promise<void> {
  await logActivity(ctx, {
    organizationId: task.organizationId,
    actorId,
    type: "task_visibility_changed",
    targetId: task._id,
    meta: { userId, hidden, projectId: task.projectId },
  });
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
    previousTaskId: await visibleNeighbour(ctx, actorId, args.previousTaskId),
    nextTaskId: await visibleNeighbour(ctx, actorId, args.nextTaskId),
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
 * A neighbour the actor may not see is treated as one that was not sent.
 * Otherwise dropping a card "after" a remembered hidden id would land it mid
 * column exactly when the hidden task is in that column, and repeating it per
 * status would follow the hidden task across the board.
 */
async function visibleNeighbour(
  ctx: MutationCtx,
  actorId: Id<"users">,
  taskId: Id<"tasks"> | undefined,
): Promise<Id<"tasks"> | undefined> {
  if (!taskId) {
    return undefined;
  }
  const neighbour = await ctx.db.get(taskId);
  if (!neighbour || (await isTaskHiddenFromUser(ctx, neighbour, actorId))) {
    return undefined;
  }
  return taskId;
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
