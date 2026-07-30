"use client";

import { useSyncExternalStore } from "react";

/**
 * A clock the UI may read during render.
 *
 * `Date.now()` in a component body fails the React Compiler purity rule, and a
 * `useEffect` + `setState` ticker fails `react-hooks/set-state-in-effect`. So the
 * time lives in a module-level store: one shared interval, one cached snapshot,
 * `useSyncExternalStore` on top — the same shape as `useTheme` and the current
 * organization store.
 *
 * The snapshot is cached because `getSnapshot` must return a stable value; a
 * fresh `Date.now()` on every call would re-render forever.
 */

const TICK_MS = 30_000;

let current = 0;
let interval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick() {
  current = Date.now();
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(onStoreChange: () => void): () => void {
  if (current === 0) {
    current = Date.now();
  }
  listeners.add(onStoreChange);
  interval ??= setInterval(tick, TICK_MS);

  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  };
}

function getSnapshot(): number {
  if (current === 0) {
    current = Date.now();
  }
  return current;
}

/** Server render has no clock; relative times resolve on the client. */
function getServerSnapshot(): number {
  return 0;
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
