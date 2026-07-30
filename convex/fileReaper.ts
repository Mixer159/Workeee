import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { deleteFile } from "./lib/files";

/**
 * The orphaned-file reaper.
 *
 * Two upload surfaces can leave a blob behind that nothing will ever point at
 * again:
 *
 * - **`context: "comment"`** — the composer uploads the image before the comment
 *   exists. `comments.create` claims the file by writing `commentId` onto it. A
 *   composer that is abandoned (tab closed, draft cleared) leaves a `comment`
 *   file with no `commentId` and no owner: `files.remove` refuses claimed files,
 *   and nothing lists unclaimed ones.
 * - **`context: "content"`** — BlockNote uploads on drop and stores the serving
 *   URL inside the document. Deleting the image block removes the URL from the
 *   JSON; the `files` row and the blob stay.
 *
 * Both are reaped **once a day, and only when they are older than the age
 * threshold** (24 h by default). The grace period is what makes it safe: a file
 * uploaded seconds ago is still being written into a comment or a document that
 * has not autosaved yet, and killing it would break the surface it belongs to.
 *
 * `olderThanMs` is an argument rather than a constant because `_creationTime` is
 * assigned by the database — a test cannot fake an old row, so it passes `0`
 * instead and reaps everything it just created.
 *
 * The scan is index-driven: `by_context` is `["context"]` plus the implicit
 * `_creationTime`, so each branch reads its own candidates oldest-first, already
 * cut off at the threshold, and takes at most `limit` of them.
 */

/** 24 hours. Long enough that no live composer or unsaved document is inside it. */
export const DEFAULT_ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

/** Rows examined per branch per run. A day's worth of uploads is far below this. */
export const DEFAULT_REAP_LIMIT = 500;

type ReapResult = {
  /** Unclaimed comment uploads deleted. */
  comment: number;
  /** Body images no longer named by the document deleted. */
  content: number;
  /** Rows examined across both branches. */
  scanned: number;
};

/**
 * The daily job (`convex/crons.ts`). Also runnable by hand:
 * `pnpm exec convex run fileReaper:reapOrphanedFiles '{"olderThanMs": 0}'`.
 */
export const reapOrphanedFiles = internalMutation({
  args: {
    olderThanMs: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ReapResult> => {
    const cutoff = Date.now() - (args.olderThanMs ?? DEFAULT_ORPHAN_AGE_MS);
    const limit = args.limit ?? DEFAULT_REAP_LIMIT;

    const comment = await reapUnclaimedCommentFiles(ctx, cutoff, limit);
    const content = await reapUnreferencedContentFiles(ctx, cutoff, limit);

    return {
      comment: comment.deleted,
      content: content.deleted,
      scanned: comment.scanned + content.scanned,
    };
  },
});

/** Candidates of one context, oldest first, already cut off at the threshold. */
async function candidates(
  ctx: MutationCtx,
  context: Doc<"files">["context"],
  cutoff: number,
  limit: number,
): Promise<Doc<"files">[]> {
  return await ctx.db
    .query("files")
    .withIndex("by_context", (q) =>
      q.eq("context", context).lt("_creationTime", cutoff),
    )
    .take(limit);
}

/** A `comment` file with no `commentId` was never posted with anything. */
async function reapUnclaimedCommentFiles(
  ctx: MutationCtx,
  cutoff: number,
  limit: number,
): Promise<{ deleted: number; scanned: number }> {
  const rows = await candidates(ctx, "comment", cutoff, limit);
  let deleted = 0;
  for (const file of rows) {
    if (file.commentId !== undefined) {
      continue;
    }
    await deleteFile(ctx, file);
    deleted += 1;
  }
  return { deleted, scanned: rows.length };
}

/**
 * A `content` file the task's document no longer names.
 *
 * The document stores the serving URL BlockNote was handed on upload, and that
 * URL carries the storage id, so a substring test against both the URL and the
 * raw id is enough — the server never parses the block JSON, here no more than
 * anywhere else. A task with no `taskContent` row has an empty description, so
 * every `content` file on it is orphaned by definition.
 */
async function reapUnreferencedContentFiles(
  ctx: MutationCtx,
  cutoff: number,
  limit: number,
): Promise<{ deleted: number; scanned: number }> {
  const rows = await candidates(ctx, "content", cutoff, limit);
  const documents = new Map<Id<"tasks">, string | null>();
  let deleted = 0;

  for (const file of rows) {
    if (!documents.has(file.taskId)) {
      const row = await ctx.db
        .query("taskContent")
        .withIndex("by_task", (q) => q.eq("taskId", file.taskId))
        .unique();
      documents.set(file.taskId, row?.content ?? null);
    }
    const content = documents.get(file.taskId) ?? null;
    if (content !== null && (await isReferenced(ctx, content, file.storageId))) {
      continue;
    }
    await deleteFile(ctx, file);
    deleted += 1;
  }

  return { deleted, scanned: rows.length };
}

async function isReferenced(
  ctx: MutationCtx,
  content: string,
  storageId: Id<"_storage">,
): Promise<boolean> {
  if (content.includes(storageId)) {
    return true;
  }
  const url = await ctx.storage.getUrl(storageId);
  return url !== null && content.includes(url);
}
