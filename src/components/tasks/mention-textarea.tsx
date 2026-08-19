"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  mentionQueryAt,
  mentionRanges,
  type CommentDraft,
  type DraftMention,
} from "@/lib/comment-draft";
import { userInitials } from "@/lib/user";
import { cn } from "@/lib/utils";

export type MentionMember = {
  _id: DraftMention["userId"];
  name: string;
  email: string;
  image?: string;
};

/** How many people the picker offers at once. */
const MAX_SUGGESTIONS = 6;

/**
 * An auto-growing textarea that shows mentions as accent-colored chips.
 *
 * The chips are a backdrop: a div in normal flow renders the text with the
 * mention spans styled and therefore decides the height, and the textarea sits
 * on top of it with transparent text. One element owns the typography, so the
 * two can't drift apart, and the growing is free.
 */
export function MentionTextarea({
  draft,
  onDraftChange,
  members,
  placeholder,
  disabled,
  autoFocus,
  minRows = 1,
  onSubmit,
  onCancel,
  onPasteFiles,
}: {
  draft: CommentDraft;
  onDraftChange: (draft: CommentDraft) => void;
  members: MentionMember[];
  placeholder: string;
  disabled?: boolean;
  autoFocus?: boolean;
  minRows?: number;
  onSubmit?: () => void;
  onCancel?: () => void;
  onPasteFiles?: (files: File[]) => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [picker, setPicker] = useState<{ start: number; query: string } | null>(
    null,
  );
  const [highlight, setHighlight] = useState(0);

  // Only ever moves the caret — never sets state — so the React Compiler rule
  // against `setState` in an effect is respected.
  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret !== null && textarea.current) {
      textarea.current.focus();
      textarea.current.setSelectionRange(caret, caret);
      pendingCaret.current = null;
    }
  });

  const suggestions = picker
    ? filterMembers(members, picker.query).slice(0, MAX_SUGGESTIONS)
    : [];
  const active = suggestions.length === 0 ? 0 : Math.min(highlight, suggestions.length - 1);

  const syncPicker = (text: string, caret: number) => {
    const found = mentionQueryAt(text, caret);
    setPicker(found);
    setHighlight(0);
  };

  const insertMention = (member: MentionMember) => {
    if (!picker) {
      return;
    }
    const caret = textarea.current?.selectionStart ?? draft.text.length;
    const inserted = `@${member.name} `;
    const text =
      draft.text.slice(0, picker.start) + inserted + draft.text.slice(caret);
    const mentions = draft.mentions.some((m) => m.userId === member._id)
      ? draft.mentions
      : [...draft.mentions, { userId: member._id, name: member.name }];

    onDraftChange({ text, mentions });
    pendingCaret.current = picker.start + inserted.length;
    setPicker(null);
    setHighlight(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (picker && suggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlight((current) => (current + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlight(
          (current) => (current - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insertMention(suggestions[active]);
        return;
      }
      if (event.key === "Escape") {
        // Escape belongs to the picker here, not to the drawer around it —
        // which listens for it on the document and would close underneath.
        event.preventDefault();
        event.stopPropagation();
        setPicker(null);
        return;
      }
    }

    if (event.key === "Escape" && onCancel) {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && onSubmit) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "relative rounded-lg border border-input bg-transparent transition-colors dark:bg-card/60",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
          disabled && "opacity-60",
        )}
      >
        <Backdrop draft={draft} placeholder={placeholder} minRows={minRows} />
        <textarea
          ref={textarea}
          value={draft.text}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-label={placeholder}
          spellCheck
          className="absolute inset-0 size-full resize-none overflow-hidden rounded-lg bg-transparent px-3 py-2 text-sm leading-relaxed text-transparent caret-foreground outline-none placeholder:text-transparent"
          onChange={(event) => {
            onDraftChange({ ...draft, text: event.target.value });
            syncPicker(event.target.value, event.target.selectionStart);
          }}
          onClick={(event) =>
            syncPicker(
              event.currentTarget.value,
              event.currentTarget.selectionStart,
            )
          }
          onKeyUp={(event) => {
            // Up / Down belong to the open picker (consumed in keydown) and
            // must not re-sync it here: that reset the highlight to the first
            // row right after the arrow moved it.
            const pickerOwnsVertical = picker !== null && suggestions.length > 0;
            const movesCaret =
              event.key === "ArrowLeft" ||
              event.key === "ArrowRight" ||
              event.key === "Home" ||
              event.key === "End" ||
              (!pickerOwnsVertical && event.key.startsWith("Arrow"));
            if (movesCaret) {
              syncPicker(
                event.currentTarget.value,
                event.currentTarget.selectionStart,
              );
            }
          }}
          onBlur={() => setPicker(null)}
          onKeyDown={handleKeyDown}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files);
            if (files.length > 0 && onPasteFiles) {
              event.preventDefault();
              onPasteFiles(files);
            }
          }}
        />
      </div>

      {picker && suggestions.length > 0 ? (
        <ul
          role="listbox"
          aria-label="Zmínit člověka"
          className="absolute bottom-full left-0 z-50 mb-1 w-72 max-w-full overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg"
        >
          {suggestions.map((member, index) => (
            <li key={member._id}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                // `mousedown` fires before the textarea's blur closes the list.
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertMention(member);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left",
                  index === active ? "bg-accent" : "bg-transparent",
                )}
              >
                <Avatar size="sm">
                  <AvatarImage src={member.image} alt="" />
                  <AvatarFallback>{userInitials(member.name)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {member.name}
                </span>
                <span className="min-w-0 shrink truncate text-xs text-muted-foreground">
                  {member.email}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The visible layer. It carries exactly the textarea's typography and padding,
 * plus a trailing newline so a text ending in Enter still grows the box.
 */
function Backdrop({
  draft,
  placeholder,
  minRows,
}: {
  draft: CommentDraft;
  placeholder: string;
  minRows: number;
}) {
  const ranges = mentionRanges(draft);
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const [index, range] of ranges.entries()) {
    if (range.start > cursor) {
      parts.push(draft.text.slice(cursor, range.start));
    }
    parts.push(
      <span
        key={index}
        className="rounded-[0.3rem] bg-primary/10 font-medium text-primary"
      >
        {draft.text.slice(range.start, range.end)}
      </span>,
    );
    cursor = range.end;
  }
  if (cursor < draft.text.length) {
    parts.push(draft.text.slice(cursor));
  }

  return (
    <div
      aria-hidden
      className="px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap"
      style={{ minHeight: `calc(${minRows} * 1.625em + 1rem)` }}
    >
      {draft.text.length === 0 ? (
        <span className="text-muted-foreground">{placeholder}</span>
      ) : (
        parts
      )}
      {"\n"}
    </div>
  );
}

function filterMembers(
  members: MentionMember[],
  query: string,
): MentionMember[] {
  const needle = query.trim().toLocaleLowerCase("cs");
  if (needle.length === 0) {
    return members;
  }
  return members.filter(
    (member) =>
      member.name.toLocaleLowerCase("cs").includes(needle) ||
      member.email.toLocaleLowerCase("cs").includes(needle),
  );
}
