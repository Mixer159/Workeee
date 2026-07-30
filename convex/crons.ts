import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled jobs. One entry per job, each pointing at an internal function that
 * is also runnable by hand with `pnpm exec convex run`.
 */
const crons = cronJobs();

/**
 * Delete blobs nothing points at any more — abandoned comment uploads and images
 * removed from a task description. See `convex/fileReaper.ts` for why it runs
 * daily with a 24 h grace period instead of immediately.
 *
 * 03:20 UTC: nobody is working, and it is not on the hour, where every other
 * deployment's crons pile up.
 */
crons.daily(
  "reap orphaned files",
  { hourUTC: 3, minuteUTC: 20 },
  internal.fileReaper.reapOrphanedFiles,
  {},
);

export default crons;
