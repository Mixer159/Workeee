"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { DownloadIcon, Loader2Icon, PaperclipIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { FileTypeIcon } from "@/components/tasks/file-type-icon";
import {
  ImageLightbox,
  type LightboxImage,
} from "@/components/tasks/image-lightbox";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/format";
import { uploadTaskFile } from "@/lib/upload";

/**
 * "Přílohy" — files hanging off the task itself. Images inside the description
 * and images posted in comments live where they were written and deliberately
 * do not appear here.
 */
export function TaskAttachments({ taskId }: { taskId: Id<"tasks"> }) {
  const files = useQuery(api.files.listByTask, { taskId });
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const register = useMutation(api.files.register);
  const removeFile = useMutation(api.files.remove);

  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<LightboxImage | null>(null);

  const handleFiles = async (selected: FileList | null) => {
    if (!selected || selected.length === 0 || uploading) {
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(selected)) {
        await uploadTaskFile(
          { generateUploadUrl, register },
          { taskId, file, context: "attachment" },
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Soubor se nepovedlo nahrát.",
      );
    } finally {
      setUploading(false);
      if (input.current) {
        input.current.value = "";
      }
    }
  };

  const handleRemove = async (fileId: Id<"files">) => {
    try {
      await removeFile({ fileId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Soubor se nepovedlo smazat.",
      );
    }
  };

  const rows = files ?? [];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Přílohy</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          {uploading ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <PaperclipIcon />
          )}
          {uploading ? "Nahrává se…" : "Nahrát soubor"}
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Zatím žádné přílohy.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {rows.map((file) => (
            <li key={file._id} className="flex items-center gap-3 px-3 py-2">
              {file.isImage && file.url ? (
                <button
                  type="button"
                  aria-label={`Zobrazit ${file.fileName}`}
                  onClick={() =>
                    setPreview({ url: file.url!, fileName: file.fileName })
                  }
                  className="size-9 shrink-0 overflow-hidden rounded-md border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file.url}
                    alt=""
                    className="size-full object-cover"
                  />
                </button>
              ) : (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileTypeIcon mimeType={file.mimeType} className="size-4" />
                </span>
              )}

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{file.fileName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                  {file.uploadedBy ? ` · ${file.uploadedBy.name}` : ""}
                </span>
              </div>

              {file.url ? (
                <Button variant="ghost" size="icon-sm" asChild>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Stáhnout ${file.fileName}`}
                  >
                    <DownloadIcon />
                  </a>
                </Button>
              ) : null}
              {file.canRemove ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Smazat ${file.fileName}`}
                  onClick={() => void handleRemove(file._id)}
                >
                  <XIcon />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <ImageLightbox image={preview} onClose={() => setPreview(null)} />
    </section>
  );
}
