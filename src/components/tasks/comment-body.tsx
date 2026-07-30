import type { CommentSegment } from "@convex/lib/commentBody";

/**
 * A stored comment body. Text keeps its line breaks, a mention becomes an indigo
 * chip — the app's one accent, the same one the composer previews.
 */
export function CommentBody({ segments }: { segments: CommentSegment[] }) {
  if (segments.length === 0) {
    return null;
  }
  return (
    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
      {segments.map((segment, index) =>
        segment.type === "mention" ? (
          <MentionChip key={index} name={segment.name} />
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </p>
  );
}

export function MentionChip({ name }: { name: string }) {
  return (
    <span className="rounded-[0.3rem] bg-primary/10 px-1 py-px font-medium text-primary">
      @{name}
    </span>
  );
}
