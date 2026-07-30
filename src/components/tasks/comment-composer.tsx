"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import {
  Loader2Icon,
  PaperclipIcon,
  SendHorizontalIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { serializeCommentBody } from "@convex/lib/commentBody";
import { FileTypeIcon } from "@/components/tasks/file-type-icon";
import {
  MentionTextarea,
  type MentionMember,
} from "@/components/tasks/mention-textarea";
import { Button } from "@/components/ui/button";
import {
  draftToSegments,
  EMPTY_DRAFT,
  isDraftEmpty,
  type CommentDraft,
} from "@/lib/comment-draft";
import { formatFileSize } from "@/lib/format";
import { uploadTaskFile, type UploadedFile } from "@/lib/upload";

/**
 * The bottom of the "Komentáře" section: write, mention with `@`, attach or
 * paste an image, Enter to send.
 *
 * Files are uploaded the moment they are picked, so the preview is the real
 * stored file; the comment then claims them. Removing a preview before sending
 * deletes the upload again.
 */
export function CommentComposer({
  taskId,
  members,
}: {
  taskId: Id<"tasks">;
  members: MentionMember[];
}) {
  const createComment = useMutation(api.comments.create);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const register = useMutation(api.files.register);
  const removeFile = useMutation(api.files.remove);

  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<CommentDraft>(EMPTY_DRAFT);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const attach = async (files: File[]) => {
    if (files.length === 0 || uploading) {
      return;
    }
    setUploading(true);
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of files) {
        uploaded.push(
          await uploadTaskFile(
            { generateUploadUrl, register },
            { taskId, file, context: "comment" },
          ),
        );
      }
      setAttachments((current) => [...current, ...uploaded]);
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

  const detach = async (file: UploadedFile) => {
    setAttachments((current) =>
      current.filter((candidate) => candidate._id !== file._id),
    );
    try {
      await removeFile({ fileId: file._id });
    } catch {
      // The preview is gone either way; a leftover blob is not worth a toast.
    }
  };

  const send = async () => {
    if (sending || uploading) {
      return;
    }
    if (isDraftEmpty(draft) && attachments.length === 0) {
      return;
    }
    setSending(true);
    try {
      await createComment({
        taskId,
        body: serializeCommentBody(draftToSegments(draft)),
        attachmentIds:
          attachments.length > 0
            ? attachments.map((file) => file._id)
            : undefined,
      });
      setDraft(EMPTY_DRAFT);
      setAttachments([]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Komentář se nepovedlo uložit.",
      );
    } finally {
      setSending(false);
    }
  };

  const canSend = !sending && !uploading && (!isDraftEmpty(draft) || attachments.length > 0);

  return (
    <div className="flex flex-col gap-2">
      <MentionTextarea
        draft={draft}
        onDraftChange={setDraft}
        members={members}
        placeholder="Napište komentář…"
        disabled={sending}
        minRows={2}
        onSubmit={() => void send()}
        onPasteFiles={(files) => void attach(files)}
      />

      {attachments.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {attachments.map((file) => (
            <li
              key={file._id}
              className="relative flex items-center gap-2 rounded-lg border border-border p-1 pr-7"
            >
              {file.isImage && file.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.url}
                  alt=""
                  className="size-10 rounded-md object-cover"
                />
              ) : (
                <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileTypeIcon mimeType={file.mimeType} className="size-4" />
                </span>
              )}
              <span className="flex min-w-0 flex-col">
                <span className="max-w-40 truncate text-xs">
                  {file.fileName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Odebrat ${file.fileName}`}
                className="absolute top-1 right-1"
                onClick={() => void detach(file)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        {/* Icon only: "Přílohy" a few centimetres above already owns the words
            for attaching a file, and the paperclip needs none. */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Připojit soubor ke komentáři"
          disabled={uploading || sending}
          onClick={() => input.current?.click()}
        >
          {uploading ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <PaperclipIcon />
          )}
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          onChange={(event) =>
            void attach(Array.from(event.target.files ?? []))
          }
        />

        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            „@“ zmíní člověka · Enter odešle
          </span>
          <Button
            type="button"
            size="sm"
            disabled={!canSend}
            onClick={() => void send()}
          >
            {sending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <SendHorizontalIcon />
            )}
            Odeslat
          </Button>
        </div>
      </div>
    </div>
  );
}
