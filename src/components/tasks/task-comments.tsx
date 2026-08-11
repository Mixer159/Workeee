"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CommentComposer } from "@/components/tasks/comment-composer";
import { CommentItem } from "@/components/tasks/comment-item";
import {
  ImageLightbox,
  type LightboxImage,
} from "@/components/tasks/image-lightbox";
import type { MentionMember } from "@/components/tasks/mention-textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/use-now";

/** The "Komentáře" section: the stream, oldest first, and the composer below it. */
export function TaskComments({
  taskId,
  members,
}: {
  taskId: Id<"tasks">;
  members: MentionMember[];
}) {
  const comments = useQuery(api.comments.listByTask, { taskId });
  const now = useNow();
  const markSeen = useMutation(api.taskSeen.markSeen);
  const [preview, setPreview] = useState<LightboxImage | null>(null);

  // "I am looking at this task" — what the unread badges and the bell count
  // against. Once when the stream has loaded, and again for every comment that
  // arrives while the panel is open: being on the task *is* reading them. A
  // Convex mutation reference is stable, so this never fires from a re-render.
  const loaded = comments !== undefined;
  const latestCommentAt = comments?.[comments.length - 1]?.createdAt ?? 0;
  useEffect(() => {
    if (!loaded) {
      return;
    }
    markSeen({ taskId }).catch(() => {
      // Read state is best effort — if the task just became unreachable, the
      // panel above this section is already saying so.
    });
  }, [taskId, loaded, latestCommentAt, markSeen]);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium">Komentáře</h2>

      {comments === undefined ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Zatím žádné komentáře.</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {comments.map((comment) => (
            <CommentItem
              key={comment._id}
              comment={comment}
              members={members}
              now={now}
              onPreview={setPreview}
            />
          ))}
        </ul>
      )}

      <CommentComposer taskId={taskId} members={members} />
      <ImageLightbox image={preview} onClose={() => setPreview(null)} />
    </section>
  );
}
