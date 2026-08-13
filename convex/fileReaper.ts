import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { deleteFile } from "./lib/files";
import { isStorageIdReferenced } from "./lib/storage";

/**
 * The orphaned-file reaper.
 *
 * An upload can leave a blob behind that nothing will ever point at again:
 *
 * - **before registration** — a client first POSTs to a generated upload URL,
 *   then calls `files.register` or `projects.setIcon`. Closing the tab between
 *   those steps leaves a raw `_storage` row with no app row pointing at it.
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
 * All three cases are reaped **once a day, and only when they are older than the age
 * threshold** (24 h by default). The grace period is what makes it safe: a file
 * uploaded seconds ago is still being written into a comment or a document that
 * has not autosaved yet, and killing it would break the surface it belongs to.
 *
 * `olderThanMs` is an argument rather than a constant because `_creationTime` is
 * assigned by the database — a test cannot fake an old row, so it passes `0`
 * instead and reaps everything it just created.
 *
 * The file-row scans are index-driven. Raw storage is paginated with a durable
 * cursor so referenced blobs at the front can never permanently hide later
 * abandoned uploads. Every branch examines at most `limit` rows per run.
 */

/** 24 hours. Long enough that no live composer or unsaved document is inside it. */
export const DEFAULT_ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

/** Rows examined per branch per run. A day's worth of uploads is far below this. */
export const DEFAULT_REAP_LIMIT = 500;

type ReapResult = {
  /** Raw uploads that no app row ever claimed. */
  untracked: number;
  /** Unclaimed comment uploads deleted. */
  comment: number;
  /** Body images no longer named by the document deleted. */
  content: number;
  /** Rows examined across all three branches. */
  scanned: number;
};

const STORAGE_CURSOR_KEY = "orphaned-storage";

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

    const untracked = await reapUntrackedStorage(ctx, cutoff, limit);
    const comment = await reapUnclaimedCommentFiles(ctx, cutoff, limit);
    const content = await reapUnreferencedContentFiles(ctx, cutoff, limit);

    return {
      untracked: untracked.deleted,
      comment: comment.deleted,
      content: content.deleted,
      scanned: untracked.scanned + comment.scanned + content.scanned,
    };
  },
});

/**
 * Delete old `_storage` rows that neither a task file nor a project icon owns.
 *
 * The scan deliberately paginates the whole system table instead of taking the
 * oldest `limit`: legitimate long-lived files would otherwise sit at the front
 * forever and starve every orphan behind them. Fresh rows may be visited, but
 * the cursor cycles back after a complete pass and they are only deleted on a
 * later pass once the grace period has elapsed.
 */
async function reapUntrackedStorage(
  ctx: MutationCtx,
  cutoff: number,
  limit: number,
): Promise<{ deleted: number; scanned: number }> {
  const state = await ctx.db
    .query("maintenanceCursors")
    .withIndex("by_key", (q) => q.eq("key", STORAGE_CURSOR_KEY))
    .unique();
  const page = await ctx.db.system
    .query("_storage")
    .withIndex("by_creation_time")
    .paginate({ cursor: state?.cursor ?? null, numItems: limit });

  let deleted = 0;
  for (const blob of page.page) {
    if (
      blob._creationTime >= cutoff ||
      (await isStorageIdReferenced(ctx, blob._id))
    ) {
      continue;
    }
    await ctx.storage.delete(blob._id);
    deleted += 1;
  }

  if (page.isDone) {
    if (state) {
      await ctx.db.delete(state._id);
    }
  } else if (state) {
    await ctx.db.patch(state._id, { cursor: page.continueCursor });
  } else {
    await ctx.db.insert("maintenanceCursors", {
      key: STORAGE_CURSOR_KEY,
      cursor: page.continueCursor,
    });
  }

  return { deleted, scanned: page.page.length };
}

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
