import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

type StorageReferenceException = {
  projectId?: Id<"projects">;
  fileId?: Id<"files">;
};

/**
 * A blob may belong to exactly one app row: either a project icon or a task
 * file. Serving URLs expose storage ids, so every claim has to check both
 * tables rather than only the table it is about to write.
 */
export async function isStorageIdReferenced(
  ctx: Ctx,
  storageId: Id<"_storage">,
  except: StorageReferenceException = {},
): Promise<boolean> {
  const [files, projects] = await Promise.all([
    ctx.db
      .query("files")
      .withIndex("by_storage", (q) => q.eq("storageId", storageId))
      .collect(),
    ctx.db
      .query("projects")
      .withIndex("by_icon_storage", (q) => q.eq("iconStorageId", storageId))
      .collect(),
  ]);
  return (
    files.some((file) => file._id !== except.fileId) ||
    projects.some((project) => project._id !== except.projectId)
  );
}

/**
 * Delete only after the owning row was cleared or removed. The extra reference
 * check protects legacy data too, should two rows ever have shared one blob.
 */
export async function deleteStorageIfUnreferenced(
  ctx: MutationCtx,
  storageId: Id<"_storage"> | undefined,
): Promise<void> {
  if (!storageId || (await isStorageIdReferenced(ctx, storageId))) {
    return;
  }
  await ctx.storage.delete(storageId);
}
