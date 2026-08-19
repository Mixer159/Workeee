import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { getProjectAccess, requireProjectAccess } from "./lib/access";
import { getAuthUserId } from "./lib/auth";
import { ORDER_STEP, appendOrder, byOrder, renumber } from "./lib/ordering";
import { touchActive } from "./lib/presence";
import { listProjectStatuses } from "./lib/taskStatuses";
import { normalizeName } from "./lib/validation";
import { taskStatusColors } from "./schema";

/**
 * A board stays readable only while it fits on a screen. The cap is a guard
 * against a runaway column list, not a product limit anyone should reach.
 */
const MAX_STATUSES = 12;

/** The columns of a project's board, left to right. */
export const list = query({
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
    const statuses = await listProjectStatuses(ctx, args.projectId);
    return statuses.map((status) => ({
      _id: status._id,
      name: status.name,
      color: status.color,
      kind: status.kind,
      order: status.order,
    }));
  },
});

/** Any project member may shape the board; the columns are shared, not private. */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    color: taskStatusColors,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const { project } = await requireProjectAccess(ctx, userId, args.projectId);
    await touchActive(ctx, userId);
    const name = normalizeName(args.name, "stavu");

    const statuses = await listProjectStatuses(ctx, args.projectId);
    if (statuses.length >= MAX_STATUSES) {
      throw new Error(`Projekt může mít nejvýš ${MAX_STATUSES} stavů.`);
    }

    const statusId = await ctx.db.insert("taskStatuses", {
      projectId: args.projectId,
      organizationId: project.organizationId,
      name,
      color: args.color,
      order: appendOrder(statuses),
      kind: "custom",
    });
    return { statusId };
  },
});

/** Rename and recolor. Core statuses may be renamed — only deleting is blocked. */
export const update = mutation({
  args: {
    statusId: v.id("taskStatuses"),
    name: v.optional(v.string()),
    color: v.optional(taskStatusColors),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const { status } = await requireStatus(ctx, userId, args.statusId);
    await touchActive(ctx, userId);

    const patch: Partial<Doc<"taskStatuses">> = {};
    if (args.name !== undefined) {
      patch.name = normalizeName(args.name, "stavu");
    }
    if (args.color !== undefined) {
      patch.color = args.color;
    }
    if (Object.keys(patch).length === 0) {
      return;
    }
    await ctx.db.patch(status._id, patch);
  },
});

/**
 * Left-to-right order of the columns.
 *
 * The client sends the ids it currently sees; the server renumbers from that
 * sequence and appends anything it does not mention (a column someone else
 * added a moment ago) at the end, so a stale board cannot delete a column from
 * the order.
 */
export const reorder = mutation({
  args: {
    projectId: v.id("projects"),
    statusIds: v.array(v.id("taskStatuses")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    await requireProjectAccess(ctx, userId, args.projectId);
    await touchActive(ctx, userId);

    const statuses = await listProjectStatuses(ctx, args.projectId);
    const byId = new Map(statuses.map((status) => [status._id, status]));

    const sequence: Doc<"taskStatuses">[] = [];
    const placed = new Set<Id<"taskStatuses">>();
    for (const statusId of args.statusIds) {
      const status = byId.get(statusId);
      if (!status || placed.has(statusId)) {
        continue;
      }
      sequence.push(status);
      placed.add(statusId);
    }
    for (const status of statuses) {
      if (!placed.has(status._id)) {
        sequence.push(status);
      }
    }

    const orders = renumber(sequence.length);
    await Promise.all(
      sequence.map((status, index) =>
        status.order === orders[index]
          ? Promise.resolve()
          : ctx.db.patch(status._id, { order: orders[index] }),
      ),
    );
  },
});

/**
 * Delete a custom status. Its tasks are never orphaned: the caller names the
 * column they move to, and they are appended there in their current order.
 */
export const remove = mutation({
  args: {
    statusId: v.id("taskStatuses"),
    moveTasksToStatusId: v.id("taskStatuses"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const { status } = await requireStatus(ctx, userId, args.statusId);
    await touchActive(ctx, userId);
    if (status.kind !== "custom") {
      throw new Error("Základní stavy nejde smazat.");
    }
    if (args.moveTasksToStatusId === args.statusId) {
      throw new Error("Vyberte, kam se úkoly přesunou.");
    }
    const target = await ctx.db.get(args.moveTasksToStatusId);
    if (!target || target.projectId !== status.projectId) {
      throw new Error("Cílový stav nepatří do tohoto projektu.");
    }

    const moving = await tasksInStatus(ctx, status._id);
    const targetTasks = await tasksInStatus(ctx, target._id);
    let order = appendOrder(targetTasks);
    const updatedAt = Date.now();
    for (const task of moving) {
      await ctx.db.patch(task._id, {
        statusId: target._id,
        order,
        updatedAt,
      });
      order += ORDER_STEP;
    }

    await ctx.db.delete(status._id);
    return { movedTasks: moving.length };
  },
});

/** A status plus the project access of the caller, or a Czech throw. */
async function requireStatus(
  ctx: MutationCtx,
  userId: Id<"users">,
  statusId: Id<"taskStatuses">,
) {
  const status = await ctx.db.get(statusId);
  if (!status) {
    throw new Error("Tento stav už neexistuje.");
  }
  const access = await requireProjectAccess(ctx, userId, status.projectId);
  return { status, access };
}

async function tasksInStatus(ctx: MutationCtx, statusId: Id<"taskStatuses">) {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_status", (q) => q.eq("statusId", statusId))
    .collect();
  return tasks.sort(byOrder);
}
