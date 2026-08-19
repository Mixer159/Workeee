import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { canManageProject } from "./lib/access";
import { getAuthUserId } from "./lib/auth";
import {
  checkStoredFile,
  countFiles,
  deleteFile,
  isImageMimeType,
  isStorageIdClaimed,
  MAX_FILES_PER_CONTEXT,
  normalizeFileName,
} from "./lib/files";
import { touchActive } from "./lib/presence";
import { getTaskAccess, requireTaskAccess, touchTask } from "./lib/tasks";
import { fileContexts } from "./schema";

/**
 * Files live on a task and are reached only through it.
 *
 * There is no "give me this storage id" endpoint: a serving URL is minted by
 * `register` for the person who just uploaded the blob, and by `listByTask` for
 * someone who can already open the task. Everything else — the size cap, the
 * content type, the per-task count — is decided from the **stored** blob in
 * `convex/lib/files.ts`, never from what the client said it was uploading.
 */

/**
 * Upload target. Authorized before the blob exists, so an outsider can never
 * obtain a writable URL into this deployment's storage.
 */
export const generateUploadUrl = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    await requireTaskAccess(ctx, userId, args.taskId);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Attach an uploaded blob to a task and hand back the URL it is served from.
 *
 * `context` decides which surface it belongs to: the attachment list, the
 * description document, or a comment that is still being written.
 *
 * **Why this one returns a result instead of throwing.** A Convex mutation is a
 * transaction: `ctx.storage.delete(...)` followed by `throw` is rolled back and
 * the rejected blob stays in storage forever. Refusing a file therefore has to
 * commit, so a validation failure comes back as `{ ok: false, error }` and the
 * client helper in `src/lib/upload.ts` turns it into the usual thrown error and
 * toast. Failures where the blob is **not** ours to delete — not signed in, no
 * access to the task, a storage id somebody else already registered — still
 * throw, and deliberately leave the blob alone.
 */
export const register = mutation({
  args: {
    taskId: v.id("tasks"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    context: fileContexts,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const { task } = await requireTaskAccess(ctx, userId, args.taskId);
    if (await isStorageIdClaimed(ctx, args.storageId)) {
      throw new Error("Tento soubor už aplikace používá.");
    }

    const existing = await countFiles(ctx, args.taskId, args.context);
    if (existing >= MAX_FILES_PER_CONTEXT) {
      await ctx.storage.delete(args.storageId);
      return {
        ok: false as const,
        error: `K úkolu jde nahrát nejvýš ${MAX_FILES_PER_CONTEXT} souborů.`,
      };
    }

    const checked = await checkStoredFile(ctx, args.storageId, args.mimeType);
    if (!checked.ok) {
      await ctx.storage.delete(args.storageId);
      return { ok: false as const, error: checked.error };
    }
    const fileName = normalizeFileName(args.fileName);

    const fileId = await ctx.db.insert("files", {
      taskId: task._id,
      projectId: task.projectId,
      organizationId: task.organizationId,
      storageId: args.storageId,
      fileName,
      mimeType: checked.mimeType,
      size: checked.size,
      context: args.context,
      uploadedBy: userId,
    });
    await touchTask(ctx, task._id);
    await touchActive(ctx, userId);

    return {
      ok: true as const,
      file: {
        _id: fileId,
        fileName,
        mimeType: checked.mimeType,
        size: checked.size,
        isImage: isImageMimeType(checked.mimeType),
        url: await ctx.storage.getUrl(args.storageId),
      },
    };
  },
});

/**
 * The "Přílohy" list. Only files attached to the task itself — images inside the
 * description and files hanging off comments are shown where they belong, not
 * duplicated here.
 */
export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const taskAccess = await getTaskAccess(ctx, userId, args.taskId);
    if (!taskAccess) {
      return [];
    }
    const manager = canManageProject(taskAccess.access);

    const files = await ctx.db
      .query("files")
      .withIndex("by_task_context", (q) =>
        q.eq("taskId", args.taskId).eq("context", "attachment"),
      )
      .collect();

    const uploaders = await loadUploaders(ctx, files);

    return await Promise.all(
      files
        .sort((a, b) => a._creationTime - b._creationTime)
        .map(async (file) => ({
          _id: file._id,
          fileName: file.fileName,
          mimeType: file.mimeType,
          size: file.size,
          isImage: isImageMimeType(file.mimeType),
          uploadedBy: uploaders.get(file.uploadedBy) ?? null,
          createdAt: file._creationTime,
          url: await ctx.storage.getUrl(file.storageId),
          canRemove: file.uploadedBy === userId || manager,
        })),
    );
  },
});

/**
 * Delete a file and its blob. The person who uploaded it or a project manager —
 * the same rule that governs deleting a task.
 *
 * A file already claimed by a posted comment is deleted with that comment, not
 * on its own, so the comment can never end up pointing at nothing.
 */
export const remove = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new Error("Tento soubor už neexistuje.");
    }
    const { access } = await requireTaskAccess(ctx, userId, file.taskId);
    if (file.uploadedBy !== userId && !canManageProject(access)) {
      throw new Error("Soubor může smazat jen ten, kdo ho nahrál, nebo správce projektu.");
    }
    if (file.commentId) {
      throw new Error("Přílohu komentáře smažete smazáním komentáře.");
    }

    await deleteFile(ctx, file);
    await touchTask(ctx, file.taskId);
  },
});

type Uploader = { name: string; image: string | undefined };

/** One read per distinct uploader, not one per file. */
async function loadUploaders(
  ctx: QueryCtx | MutationCtx,
  files: Doc<"files">[],
): Promise<Map<Doc<"files">["uploadedBy"], Uploader>> {
  const distinct = [...new Set(files.map((file) => file.uploadedBy))];
  const users = await Promise.all(distinct.map((id) => ctx.db.get(id)));
  const uploaders = new Map<Doc<"files">["uploadedBy"], Uploader>();
  for (const user of users) {
    if (user) {
      uploaders.set(user._id, { name: user.name, image: user.image });
    }
  }
  return uploaders;
}
