import type { Id } from "@convex/_generated/dataModel";
import type { CommentSegment } from "@convex/lib/commentBody";

/**
 * The composer edits a plain string — a textarea is the only control that gets
 * Czech input, mobile keyboards and undo right — so a mention has to survive as
 * text. It does: it is written as `@Jméno Příjmení`, and the draft carries the
 * user id that name belongs to.
 *
 * Serializing scans the text for the names the draft knows about and turns those
 * spans back into mention segments. Delete a character of the name and it is
 * plain text again, which is exactly what deleting part of a mention should do.
 * Two occurrences of the same name are two mentions of the same person, so the
 * ambiguity is harmless.
 */

export type DraftMention = { userId: Id<"users">; name: string };

export type CommentDraft = {
  text: string;
  mentions: DraftMention[];
};

export const EMPTY_DRAFT: CommentDraft = { text: "", mentions: [] };

export type MentionRange = {
  start: number;
  end: number;
  mention: DraftMention;
};

/**
 * Where the known mentions actually sit in the text right now. Longer names are
 * matched first so "Jana Nováková" wins over a colleague called "Jana", and a
 * matched span is never reused.
 */
export function mentionRanges(draft: CommentDraft): MentionRange[] {
  const taken: boolean[] = new Array(draft.text.length).fill(false);
  const ranges: MentionRange[] = [];

  const byLength = [...draft.mentions].sort(
    (a, b) => b.name.length - a.name.length,
  );
  for (const mention of byLength) {
    const needle = `@${mention.name}`;
    let from = 0;
    for (;;) {
      const index = draft.text.indexOf(needle, from);
      if (index === -1) {
        break;
      }
      const end = index + needle.length;
      if (!taken.slice(index, end).some(Boolean)) {
        for (let position = index; position < end; position += 1) {
          taken[position] = true;
        }
        ranges.push({ start: index, end, mention });
      }
      from = index + 1;
    }
  }

  return ranges.sort((a, b) => a.start - b.start);
}

/** The draft as the segment array the server stores. */
export function draftToSegments(draft: CommentDraft): CommentSegment[] {
  const ranges = mentionRanges(draft);
  const segments: CommentSegment[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({
        type: "text",
        text: draft.text.slice(cursor, range.start),
      });
    }
    segments.push({
      type: "mention",
      userId: range.mention.userId,
      name: range.mention.name,
    });
    cursor = range.end;
  }
  if (cursor < draft.text.length) {
    segments.push({ type: "text", text: draft.text.slice(cursor) });
  }
  return segments;
}

/** The other direction, for editing a comment that is already posted. */
export function segmentsToDraft(segments: CommentSegment[]): CommentDraft {
  let text = "";
  const mentions: DraftMention[] = [];
  for (const segment of segments) {
    if (segment.type === "text") {
      text += segment.text;
      continue;
    }
    text += `@${segment.name}`;
    if (!mentions.some((mention) => mention.userId === segment.userId)) {
      mentions.push({ userId: segment.userId, name: segment.name });
    }
  }
  return { text, mentions };
}

/** Does this draft say anything at all? */
export function isDraftEmpty(draft: CommentDraft): boolean {
  return draft.text.trim().length === 0;
}

/**
 * The `@…` the caret is currently sitting in, if any. A trigger only counts at
 * the start of the text or after whitespace, so an e-mail address never opens
 * the picker.
 */
export function mentionQueryAt(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at === -1) {
    return null;
  }
  const previous = at === 0 ? "" : before[at - 1];
  if (previous !== "" && !/\s/.test(previous)) {
    return null;
  }
  const query = before.slice(at + 1);
  if (query.length > 40 || /[\n\r]/.test(query)) {
    return null;
  }
  return { start: at, query };
}
