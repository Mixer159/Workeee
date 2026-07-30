"use client";

import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { useMutation } from "convex/react";
import { MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { serializeCommentBody } from "@convex/lib/commentBody";
import { CommentBody } from "@/components/tasks/comment-body";
import { FileTypeIcon } from "@/components/tasks/file-type-icon";
import type { LightboxImage } from "@/components/tasks/image-lightbox";
import {
  MentionTextarea,
  type MentionMember,
} from "@/components/tasks/mention-textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  draftToSegments,
  isDraftEmpty,
  segmentsToDraft,
  type CommentDraft,
} from "@/lib/comment-draft";
import { formatFileSize, formatRelativeTime } from "@/lib/format";
import { userInitials } from "@/lib/user";

export type TaskComment = FunctionReturnType<
  typeof api.comments.listByTask
>[number];

/** One message in the stream: who, when, what, and what came with it. */
export function CommentItem({
  comment,
  members,
  now,
  onPreview,
}: {
  comment: TaskComment;
  members: MentionMember[];
  now: number;
  onPreview: (image: LightboxImage) => void;
}) {
  const updateComment = useMutation(api.comments.update);
  const removeComment = useMutation(api.comments.remove);
  const [draft, setDraft] = useState<CommentDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft || isDraftEmpty(draft) || saving) {
      return;
    }
    setSaving(true);
    try {
      await updateComment({
        commentId: comment._id,
        body: serializeCommentBody(draftToSegments(draft)),
      });
      setDraft(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Úpravu se nepovedlo uložit.",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await removeComment({ commentId: comment._id });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Komentář se nepovedlo smazat.",
      );
    }
  };

  return (
    <li className="flex gap-3">
      <Avatar size="sm" className="mt-0.5">
        <AvatarImage src={comment.author?.image} alt="" />
        <AvatarFallback>{userInitials(comment.author?.name)}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {comment.author?.name ?? "Neznámý uživatel"}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatRelativeTime(comment.createdAt, now)}
            {comment.edited ? " · upraveno" : ""}
          </span>

          {comment.canEdit || comment.canRemove ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto"
                  aria-label="Možnosti komentáře"
                >
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {comment.canEdit ? (
                  <DropdownMenuItem
                    onSelect={() => setDraft(segmentsToDraft(comment.body))}
                  >
                    Upravit
                  </DropdownMenuItem>
                ) : null}
                {comment.canRemove ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => void remove()}
                  >
                    Smazat
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {draft ? (
          <div className="flex flex-col gap-2">
            <MentionTextarea
              draft={draft}
              onDraftChange={setDraft}
              members={members}
              placeholder="Upravte komentář…"
              disabled={saving}
              autoFocus
              onSubmit={() => void save()}
              onCancel={() => setDraft(null)}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={saving || isDraftEmpty(draft)}
                onClick={() => void save()}
              >
                Uložit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setDraft(null)}
              >
                Zrušit
              </Button>
            </div>
          </div>
        ) : (
          <CommentBody segments={comment.body} />
        )}

        {comment.attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {comment.attachments.map((file) =>
              file.isImage && file.url ? (
                <button
                  key={file._id}
                  type="button"
                  aria-label={`Zobrazit ${file.fileName}`}
                  onClick={() =>
                    onPreview({ url: file.url!, fileName: file.fileName })
                  }
                  className="overflow-hidden rounded-lg border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file.url}
                    alt={file.fileName}
                    className="max-h-56 max-w-full object-cover"
                  />
                </button>
              ) : (
                <a
                  key={file._id}
                  href={file.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 transition-colors hover:bg-accent"
                >
                  <FileTypeIcon
                    mimeType={file.mimeType}
                    className="size-4 text-muted-foreground"
                  />
                  <span className="max-w-48 truncate text-xs">
                    {file.fileName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </span>
                </a>
              ),
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}
