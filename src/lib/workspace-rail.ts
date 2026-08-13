"use client";

/**
 * Width of the work-mode rail, remembered across sessions. Same store shape
 * as `current-organization.ts`: localStorage behind a listener set, read
 * through `useSyncExternalStore` so render never touches `window`.
 */
export const RAIL_WIDTH_STORAGE_KEY = "workeee-workspace-rail-width";
export const RAIL_WIDTH_DEFAULT = 320;
export const RAIL_WIDTH_MIN = 260;
export const RAIL_WIDTH_MAX = 520;

const listeners = new Set<() => void>();

/** Last written value, so private mode still resizes within the tab. */
let memoryWidth: number | null = null;

export function clampRailWidth(width: number): number {
  return Math.min(RAIL_WIDTH_MAX, Math.max(RAIL_WIDTH_MIN, Math.round(width)));
}

export function readRailWidth(): number {
  if (memoryWidth !== null) {
    return memoryWidth;
  }
  if (typeof window === "undefined") {
    return RAIL_WIDTH_DEFAULT;
  }
  try {
    const raw = window.localStorage.getItem(RAIL_WIDTH_STORAGE_KEY);
    if (raw === null) {
      return RAIL_WIDTH_DEFAULT;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed)
      ? clampRailWidth(parsed)
      : RAIL_WIDTH_DEFAULT;
  } catch {
    return RAIL_WIDTH_DEFAULT;
  }
}

export function storeRailWidth(width: number): void {
  memoryWidth = clampRailWidth(width);
  try {
    window.localStorage.setItem(RAIL_WIDTH_STORAGE_KEY, String(memoryWidth));
  } catch {
    // Storage unavailable (private mode) — the width still applies in memory
    // for this tab through the listeners below.
  }
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeRailWidth(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
