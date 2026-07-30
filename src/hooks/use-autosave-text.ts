"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { SaveState } from "@/lib/save-state";

/** How long a field stays quiet before what was typed is written. */
const AUTOSAVE_MS = 700;

/**
 * A text field that saves itself: debounced while typing, flushed on blur and
 * flushed again if the field goes away before the debounce fired.
 *
 * The value is owned locally from mount on. The server value is the *initial*
 * value and nothing pushes later query results back into it — that would fight
 * whoever is typing. Remount the field (via `key`) to load another record; the
 * body editor follows the same rule.
 *
 * `save` and `canSave` must be stable — a Convex mutation, a `useCallback`, or
 * a module-level function. The pending write is flushed from an effect cleanup,
 * so an identity that changed every render would write on every render.
 */
export function useAutosaveText({
  initial,
  save,
  errorMessage,
  canSave,
  onSaveState,
  delay = AUTOSAVE_MS,
}: {
  initial: string;
  save: (value: string) => Promise<unknown>;
  errorMessage: string;
  canSave?: (value: string) => boolean;
  onSaveState?: (state: SaveState) => void;
  delay?: number;
}) {
  const [value, setValue] = useState(initial);
  // The last value the server is known to hold, so a flush with nothing new to
  // say stays silent.
  const persisted = useRef(initial);
  // What is waiting to be written, or null when nothing is.
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const write = useCallback(
    async (next: string) => {
      pending.current = null;
      if (next === persisted.current || canSave?.(next) === false) {
        return;
      }
      onSaveState?.("saving");
      try {
        await save(next);
        persisted.current = next;
        onSaveState?.("saved");
      } catch (error) {
        onSaveState?.("error");
        toast.error(error instanceof Error ? error.message : errorMessage);
      }
    },
    [save, canSave, errorMessage, onSaveState],
  );

  const change = useCallback(
    (next: string) => {
      setValue(next);
      pending.current = next;
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => void write(next), delay);
    },
    [delay, write],
  );

  /** Write now — what a blur, an Enter or a closing panel means. */
  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    if (pending.current !== null) {
      void write(pending.current);
    }
  }, [write]);

  // Closing the drawer a moment after the last keystroke must not lose it.
  // This runs outside React's lifetime, so it reports nothing and only speaks
  // up when the write fails.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      const last = pending.current;
      pending.current = null;
      if (last === null || last === persisted.current) {
        return;
      }
      if (canSave?.(last) === false) {
        return;
      }
      void Promise.resolve(save(last)).catch(() => toast.error(errorMessage));
    },
    [save, canSave, errorMessage],
  );

  return { value, change, flush };
}
