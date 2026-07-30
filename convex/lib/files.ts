import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { fileContexts } from "../schema";
import {
  deleteStorageIfUnreferenced,
  isStorageIdReferenced,
} from "./storage";

export type FileContext = Infer<typeof fileContexts>;

/** Per file. Big enough for a screenshot or a PDF, small enough to stay cheap. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Per task, per surface — 30 attachments, 30 images in the body, 30 in comments. */
export const MAX_FILES_PER_CONTEXT = 30;

/**
 * Content types we refuse even though the blob is stored on the Convex storage
 * origin: an HTML or SVG document opened from a link executes script there, and
 * `getUrl` hands out a link that anyone with it can open. Neither is worth the
 * convenience of attaching one.
 */
const BLOCKED_MIME_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/vnd.microsoft.portable-executable",
]);

export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/** `text/plain;charset=utf-8` and `text/plain` are the same type. */
function baseMimeType(value: string): string {
  return value.split(";")[0]!.trim().toLowerCase();
}

export type StoredFileCheck =
  | { ok: true; mimeType: string; size: number }
  | { ok: false; error: string };

/**
 * Validate a freshly uploaded blob and decide the content type it is filed
 * under.
 *
 * The **stored** metadata wins: it is what Convex recorded when the bytes were
 * POSTed and what it will serve the file as. The client's claim is only used
 * when storage recorded nothing at all, and the blocklist is applied to both, so
 * a file that lies in either direction is refused.
 *
 * This returns a result instead of throwing on purpose — see the note on
 * `files.register`. A rejected upload has to have its blob deleted, and a
 * mutation that throws rolls that deletion back.
 */
export async function checkStoredFile(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  claimedMimeType: string,
): Promise<StoredFileCheck> {
  const metadata = await ctx.db.system.get(storageId);
  if (!metadata) {
    return {
      ok: false,
      error: "Nahrání souboru se nepovedlo. Zkuste to prosím znovu.",
    };
  }

  const stored = baseMimeType(metadata.contentType ?? "");
  const claimed = baseMimeType(claimedMimeType);
  const mimeType = stored || claimed;

  if (
    mimeType.length === 0 ||
    BLOCKED_MIME_TYPES.has(mimeType) ||
    (claimed.length > 0 && BLOCKED_MIME_TYPES.has(claimed))
  ) {
    return { ok: false, error: "Tento typ souboru nahrát nejde." };
  }
  if (metadata.size <= 0) {
    return { ok: false, error: "Soubor je prázdný." };
  }
  if (metadata.size > MAX_FILE_BYTES) {
    return { ok: false, error: "Soubor může mít nejvýš 10 MB." };
  }

  return { ok: true, mimeType, size: metadata.size };
}

/** Is this blob already claimed by any app row? Blobs are never shared. */
export async function isStorageIdClaimed(
  ctx: QueryCtx | MutationCtx,
  storageId: Id<"_storage">,
): Promise<boolean> {
  return await isStorageIdReferenced(ctx, storageId);
}

/** How many files this task already holds on the given surface. */
export async function countFiles(
  ctx: QueryCtx | MutationCtx,
  taskId: Id<"tasks">,
  context: FileContext,
): Promise<number> {
  const rows = await ctx.db
    .query("files")
    .withIndex("by_task_context", (q) =>
      q.eq("taskId", taskId).eq("context", context),
    )
    .collect();
  return rows.length;
}

/** Delete a file row and its blob, unless legacy data still references it. */
export async function deleteFile(
  ctx: MutationCtx,
  file: Doc<"files">,
): Promise<void> {
  await ctx.db.delete(file._id);
  await deleteStorageIfUnreferenced(ctx, file.storageId);
}

/** Every file a task owns, across all three surfaces. */
export async function listTaskFiles(
  ctx: QueryCtx | MutationCtx,
  taskId: Id<"tasks">,
): Promise<Doc<"files">[]> {
  return await ctx.db
    .query("files")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .collect();
}

/** Bounded filename, sanitized: no path separators, no control characters. */
export function normalizeFileName(value: string): string {
  const name = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "-")
    .trim();
  if (name.length === 0) {
    return "soubor";
  }
  return name.slice(0, 200);
}
