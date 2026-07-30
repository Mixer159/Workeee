import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { deleteStorageIfUnreferenced } from "./lib/storage";
import { deleteTaskChildren } from "./lib/tasks";

/**
 * Emptying a deleted organization.
 *
 * `organizations.remove` does the part that has to be atomic — it deletes the
 * memberships and the invites, which are the only two ways into an organization,
 * so from that one transaction on nobody can reach it any more. Everything else
 * (projects, boards, tasks, task bodies, files and their blobs, comments, the
 * audit trail) is swept up here, in the background, **batch by batch**.
 *
 * The reason it is not one big cascade: a Convex mutation is a transaction with
 * a document limit, and an organization is unbounded — a year-old team has more
 * tasks and comments than a single transaction may touch. A delete button that
 * works for a fresh organization and fails for a real one is worse than none.
 *
 * So each run spends a fixed budget of documents and reschedules itself with no
 * delay while there is work left. Progress is measured by deletion, never by a
 * cursor: every run starts from the first remaining row, which makes the job
 * restartable and safe to run by hand:
 *
 *     pnpm exec convex run organizationPurge:purge '{"organizationId": "..."}'
 */

/** Documents deleted per run. Far below the transaction limit, above a small org. */
export const PURGE_BATCH = 200;

type PurgeResult = {
  /** Documents deleted in this run. */
  deleted: number;
  /** True when the organization is gone and nothing was rescheduled. */
  done: boolean;
};

/** What is left of this run's allowance. Passed down and spent in place. */
type Budget = { left: number };

export const purge = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<PurgeResult> => {
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      return { deleted: 0, done: true };
    }

    const budget: Budget = { left: args.limit ?? PURGE_BATCH };
    const allowance = budget.left;

    // `&&` short-circuits, which is the point: the first stage that runs out of
    // budget stops the rest, and the next run picks up exactly where it left off.
    const done =
      (await purgeProjects(ctx, args.organizationId, budget)) &&
      (await purgeMemberships(ctx, args.organizationId, budget)) &&
      (await purgeInvites(ctx, args.organizationId, budget)) &&
      (await purgeActivityLogs(ctx, args.organizationId, budget));

    if (done) {
      await ctx.db.delete(args.organizationId);
    } else {
      await ctx.scheduler.runAfter(0, internal.organizationPurge.purge, {
        organizationId: args.organizationId,
        limit: args.limit,
      });
    }

    return { deleted: allowance - budget.left, done };
  },
});

/** One project at a time, each drained completely before the next is started. */
async function purgeProjects(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  budget: Budget,
): Promise<boolean> {
  for (;;) {
    if (budget.left <= 0) {
      return false;
    }
    const project = await ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .first();
    if (!project) {
      return true;
    }
    if (!(await purgeProject(ctx, project, budget))) {
      return false;
    }
  }
}

/**
 * Tasks first — they own the body, the files and the comments — then the board's
 * columns and the explicit grants, then the project and its icon blob.
 */
async function purgeProject(
  ctx: MutationCtx,
  project: Doc<"projects">,
  budget: Budget,
): Promise<boolean> {
  for (;;) {
    if (budget.left <= 0) {
      return false;
    }
    const task = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .first();
    if (!task) {
      break;
    }
    budget.left -= await deleteTaskChildren(ctx, task._id);
    await ctx.db.delete(task._id);
    budget.left -= 1;
  }

  const drained =
    (await drain(ctx, budget, (limit) =>
      ctx.db
        .query("taskStatuses")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .take(limit),
    )) &&
    (await drain(ctx, budget, (limit) =>
      ctx.db
        .query("projectMembers")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .take(limit),
    ));
  if (!drained || budget.left <= 0) {
    return false;
  }

  await ctx.db.delete(project._id);
  await deleteStorageIfUnreferenced(ctx, project.iconStorageId);
  budget.left -= 1;
  return true;
}

function purgeMemberships(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  budget: Budget,
): Promise<boolean> {
  // Normally already empty: `organizations.remove` deletes these first, because
  // a membership is what every read and write in the app authorizes through.
  return drain(ctx, budget, (limit) =>
    ctx.db
      .query("organizationMembers")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .take(limit),
  );
}

function purgeInvites(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  budget: Budget,
): Promise<boolean> {
  return drain(ctx, budget, (limit) =>
    ctx.db
      .query("invites")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .take(limit),
  );
}

function purgeActivityLogs(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  budget: Budget,
): Promise<boolean> {
  return drain(ctx, budget, (limit) =>
    ctx.db
      .query("activityLogs")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .take(limit),
  );
}

/**
 * Delete everything `read` returns, never more than the budget allows. `true`
 * means the query came back empty and the table is done with.
 */
async function drain(
  ctx: MutationCtx,
  budget: Budget,
  read: (limit: number) => Promise<{ _id: Id<TableNames> }[]>,
): Promise<boolean> {
  for (;;) {
    if (budget.left <= 0) {
      return false;
    }
    const rows = await read(budget.left);
    if (rows.length === 0) {
      return true;
    }
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    budget.left -= rows.length;
  }
}
