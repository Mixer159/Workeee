import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getProjectAccess, requireProjectAccess, type ProjectAccess } from "./access";
import { deleteFile, listTaskFiles } from "./files";

type Ctx = QueryCtx | MutationCtx;

export type TaskAccess = { task: Doc<"tasks">; access: ProjectAccess };

/**
 * A task plus the caller's access to its project, or `null` when the task does
 * not exist or its project is invisible to them. Everything hanging off a task —
 * the description, its files, its comments — authorizes through this one call,
 * so the project access is resolved exactly once per request.
 */
export async function getTaskAccess(
  ctx: Ctx,
  userId: Id<"users">,
  taskId: Id<"tasks">,
): Promise<TaskAccess | null> {
  const task = await ctx.db.get(taskId);
  if (!task) {
    return null;
  }
  const access = await getProjectAccess(ctx, userId, task.projectId);
  if (!access) {
    return null;
  }
  return { task, access };
}

/** The throwing variant, for mutations. */
export async function requireTaskAccess(
  ctx: Ctx,
  userId: Id<"users">,
  taskId: Id<"tasks">,
): Promise<TaskAccess> {
  const task = await ctx.db.get(taskId);
  if (!task) {
    throw new Error("Tento úkol už neexistuje.");
  }
  const access = await requireProjectAccess(ctx, userId, task.projectId);
  return { task, access };
}

/**
 * Bump `tasks.updatedAt`.
 *
 * The board and the detail page read "naposledy upraveno" from the task, so a
 * change to its body, its files or its comments has to move it too — otherwise a
 * task that has been discussed all afternoon still looks untouched.
 */
export async function touchTask(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
): Promise<void> {
  await ctx.db.patch(taskId, { updatedAt: Date.now() });
}

/**
 * Everything that hangs off a task: its body, its files (blobs included) and its
 * comments. A deleted task must not leave a blob nobody can reach — there is no
 * other path to a file than the task it belongs to.
 *
 * Returns how many documents went with it, which is what the organization purge
 * (`convex/organizationPurge.ts`) measures its batch against — a task carrying
 * thirty attachments is not the same amount of work as an empty one.
 */
export async function deleteTaskChildren(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
): Promise<number> {
  const [content, files, comments] = await Promise.all([
    ctx.db
      .query("taskContent")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect(),
    listTaskFiles(ctx, taskId),
    ctx.db
      .query("comments")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect(),
  ]);
  await Promise.all([
    ...content.map((row) => ctx.db.delete(row._id)),
    ...files.map((file) => deleteFile(ctx, file)),
    ...comments.map((comment) => ctx.db.delete(comment._id)),
  ]);
  return content.length + files.length + comments.length;
}
