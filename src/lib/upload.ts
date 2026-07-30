import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

/**
 * The three-step upload every file in the app goes through:
 *
 * 1. `files.generateUploadUrl` — authorized against the task *before* a blob
 *    can exist,
 * 2. `POST` the bytes straight to Convex storage,
 * 3. `files.register` — validates the stored blob and creates the row.
 *
 * `register` answers with a result instead of throwing so that it can actually
 * delete the blob of a rejected upload (a thrown mutation rolls the deletion
 * back). This helper is where that result becomes an ordinary `Error`, so every
 * call site keeps the usual try / catch / toast shape.
 */

export type FileContext = "attachment" | "content" | "comment";

type RegisterResult = FunctionReturnType<typeof api.files.register>;
export type UploadedFile = Extract<RegisterResult, { ok: true }>["file"];

export type UploadDeps = {
  generateUploadUrl: (args: { taskId: Id<"tasks"> }) => Promise<string>;
  register: (args: {
    taskId: Id<"tasks">;
    storageId: Id<"_storage">;
    fileName: string;
    mimeType: string;
    context: FileContext;
  }) => Promise<RegisterResult>;
};

/** Mirrors the server cap so an obviously-too-big file never leaves the browser. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function uploadTaskFile(
  deps: UploadDeps,
  args: { taskId: Id<"tasks">; file: File; context: FileContext },
): Promise<UploadedFile> {
  if (args.file.size > MAX_FILE_BYTES) {
    throw new Error("Soubor může mít nejvýš 10 MB.");
  }

  const uploadUrl = await deps.generateUploadUrl({ taskId: args.taskId });
  const mimeType = args.file.type || "application/octet-stream";
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": mimeType },
    body: args.file,
  });
  if (!response.ok) {
    throw new Error("Nahrání souboru se nepovedlo.");
  }
  const { storageId } = (await response.json()) as {
    storageId: Id<"_storage">;
  };

  const result = await deps.register({
    taskId: args.taskId,
    storageId,
    fileName: args.file.name,
    mimeType,
    context: args.context,
  });
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.file;
}
