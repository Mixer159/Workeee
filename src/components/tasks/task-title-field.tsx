"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAutosaveText } from "@/hooks/use-autosave-text";
import type { SaveState } from "@/lib/save-state";

/** An empty title is a moment while typing, not something to write. */
function hasText(value: string) {
  return value.trim().length > 0;
}

/**
 * The task title, always editable — no click-to-edit step, no save button. It
 * is a textarea so a long title wraps the way the heading it replaces did.
 */
export function TaskTitleField({
  taskId,
  title,
  onSaveState,
}: {
  taskId: Id<"tasks">;
  title: string;
  onSaveState: (state: SaveState) => void;
}) {
  const updateTitle = useMutation(api.tasks.updateTitle);
  const save = useCallback(
    (value: string) => updateTitle({ taskId, title: value }),
    [updateTitle, taskId],
  );
  const { value, change, flush } = useAutosaveText({
    initial: title,
    save,
    canSave: hasText,
    errorMessage: "Název se nepovedlo uložit.",
    onSaveState,
  });

  const field = useRef<HTMLTextAreaElement>(null);
  // The field grows with the title instead of scrolling. This only ever
  // touches the DOM, so it stays out of React state.
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) {
      return;
    }
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={field}
      value={value}
      rows={1}
      maxLength={200}
      aria-label="Název úkolu"
      placeholder="Název úkolu"
      onChange={(event) => change(event.target.value)}
      onBlur={flush}
      onKeyDown={(event) => {
        // A title is one line of meaning; Enter ends it instead of breaking it.
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      className="-mx-2 resize-none overflow-hidden rounded-lg bg-transparent px-2 py-1 font-heading text-[1.375rem] leading-snug font-bold tracking-[-0.02em] outline-none transition-colors hover:bg-accent focus:hover:bg-transparent focus-visible:ring-3 focus-visible:ring-ring/40"
    />
  );
}
