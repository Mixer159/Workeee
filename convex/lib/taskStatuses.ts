import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { taskStatusColors, taskStatusKinds } from "../schema";
import { ORDER_STEP, byOrder } from "./ordering";

export type TaskStatusColor = Infer<typeof taskStatusColors>;
export type TaskStatusKind = Infer<typeof taskStatusKinds>;

/**
 * The three statuses every project starts with. They can be renamed, recolored
 * and reordered, but not deleted — `kind` keeps the meaning even after a rename,
 * which is what later "done" semantics (progress, completion counts) read.
 */
export const CORE_STATUSES: readonly {
  name: string;
  color: TaskStatusColor;
  kind: TaskStatusKind;
}[] = [
  { name: "To-do", color: "gray", kind: "todo" },
  { name: "V průběhu", color: "blue", kind: "in_progress" },
  { name: "Hotovo", color: "green", kind: "done" },
];

/**
 * Give a project its three core statuses. Idempotent: a project that already
 * has statuses is left alone, so the backfill migration can be re-run safely.
 */
export async function seedProjectStatuses(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  organizationId: Id<"organizations">,
): Promise<number> {
  const existing = await ctx.db
    .query("taskStatuses")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .first();
  if (existing) {
    return 0;
  }
  for (const [index, status] of CORE_STATUSES.entries()) {
    await ctx.db.insert("taskStatuses", {
      projectId,
      organizationId,
      name: status.name,
      color: status.color,
      order: (index + 1) * ORDER_STEP,
      kind: status.kind,
    });
  }
  return CORE_STATUSES.length;
}

/** Every status of a project, left to right. */
export async function listProjectStatuses(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
): Promise<Doc<"taskStatuses">[]> {
  const statuses = await ctx.db
    .query("taskStatuses")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();
  return statuses.sort(byOrder);
}
