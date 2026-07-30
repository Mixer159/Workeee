import type { Id } from "../_generated/dataModel";

/**
 * The wire format of a comment body — the one place it is defined.
 *
 * A comment is an array of segments, serialized to JSON and stored in
 * `comments.body`:
 *
 * ```json
 * [{"type":"text","text":"Mrkni na to "},
 *  {"type":"mention","userId":"j57…","name":"Jana Nováková"},
 *  {"type":"text","text":", prosím."}]
 * ```
 *
 * Segments rather than markdown, because a mention has to survive as a real
 * `Id<"users">`: the notification system of a later phase reads the ids, it does
 * not re-parse prose. The `name` next to it is display copy frozen at the moment
 * the comment was written.
 *
 * This module is pure TypeScript and is imported by both sides — the composer in
 * `src/components/tasks/` builds segments with it and `convex/comments.ts`
 * validates them with it. The server never trusts the client's serialization; it
 * re-parses and re-checks every mention.
 */

export type CommentTextSegment = { type: "text"; text: string };

export type CommentMentionSegment = {
  type: "mention";
  userId: Id<"users">;
  name: string;
};

export type CommentSegment = CommentTextSegment | CommentMentionSegment;

/** Plain text only; a mention counts as its display name. */
export const MAX_COMMENT_LENGTH = 5000;

/** Guards against a pathological body with thousands of one-character parts. */
export const MAX_COMMENT_SEGMENTS = 200;

/** Longest name a mention segment may carry, matching `MAX_NAME_LENGTH`. */
const MAX_MENTION_NAME_LENGTH = 60;

export function serializeCommentBody(segments: CommentSegment[]): string {
  return JSON.stringify(segments);
}

/**
 * Parse a stored or client-supplied body. Returns `null` for anything that is
 * not a well-formed segment array — callers decide whether that is an empty
 * render (queries) or a thrown error (mutations).
 */
export function parseCommentBody(raw: string): CommentSegment[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_COMMENT_SEGMENTS) {
    return null;
  }

  const segments: CommentSegment[] = [];
  for (const candidate of parsed) {
    if (typeof candidate !== "object" || candidate === null) {
      return null;
    }
    const segment = candidate as Record<string, unknown>;
    if (segment.type === "text") {
      if (typeof segment.text !== "string") {
        return null;
      }
      segments.push({ type: "text", text: segment.text });
      continue;
    }
    if (segment.type === "mention") {
      if (
        typeof segment.userId !== "string" ||
        segment.userId.length === 0 ||
        typeof segment.name !== "string" ||
        segment.name.length === 0 ||
        segment.name.length > MAX_MENTION_NAME_LENGTH
      ) {
        return null;
      }
      segments.push({
        type: "mention",
        userId: segment.userId as Id<"users">,
        name: segment.name,
      });
      continue;
    }
    return null;
  }
  return segments;
}

/** What the body reads as in plain text — used for the length bound. */
export function commentBodyText(segments: CommentSegment[]): string {
  return segments
    .map((segment) =>
      segment.type === "text" ? segment.text : `@${segment.name}`,
    )
    .join("");
}

/** Drops empty text segments and merges neighbours, so `""` normalizes away. */
export function compactCommentBody(segments: CommentSegment[]): CommentSegment[] {
  const compacted: CommentSegment[] = [];
  for (const segment of segments) {
    if (segment.type === "text") {
      if (segment.text.length === 0) {
        continue;
      }
      const previous = compacted[compacted.length - 1];
      if (previous?.type === "text") {
        previous.text += segment.text;
        continue;
      }
      compacted.push({ type: "text", text: segment.text });
      continue;
    }
    compacted.push(segment);
  }
  return compacted;
}

/** The distinct user ids a body mentions. */
export function mentionedUserIds(segments: CommentSegment[]): Id<"users">[] {
  return [
    ...new Set(
      segments
        .filter(
          (segment): segment is CommentMentionSegment =>
            segment.type === "mention",
        )
        .map((segment) => segment.userId),
    ),
  ];
}
