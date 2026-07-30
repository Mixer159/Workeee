"use client";

import type { SaveState } from "@/lib/save-state";

const LABEL: Record<SaveState, string> = {
  idle: "",
  saving: "Ukládá se…",
  saved: "Uloženo",
  error: "Neuloženo",
};

/**
 * The one place the task detail says anything about saving. Nothing here
 * toasts — a successful autosave is not news, only a failed one is.
 */
export function TaskSaveIndicator({ state }: { state: SaveState }) {
  return (
    <span
      aria-live="polite"
      className="text-xs text-muted-foreground transition-opacity duration-200"
      style={{ opacity: state === "idle" ? 0 : 1 }}
    >
      {LABEL[state]}
    </span>
  );
}
