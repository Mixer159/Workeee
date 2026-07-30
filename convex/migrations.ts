import { internalMutation } from "./_generated/server";
import { seedProjectStatuses } from "./lib/taskStatuses";

/**
 * One-off backfills. Each one is reachable only as
 * `pnpm exec convex run migrations:<name>` and must be safe to run twice — they stay
 * in the repo as the record of what was done to a deployment.
 */

/**
 * Phase 3. Projects created before task statuses existed have an empty board;
 * give them the same three core statuses a new project is seeded with.
 * `seedProjectStatuses` skips a project that already has any status.
 */
export const seedTaskStatuses = internalMutation({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    let seeded = 0;
    for (const project of projects) {
      const inserted = await seedProjectStatuses(
        ctx,
        project._id,
        project.organizationId,
      );
      if (inserted > 0) {
        seeded += 1;
      }
    }
    return { projects: projects.length, seeded };
  },
});
