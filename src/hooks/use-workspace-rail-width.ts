"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  RAIL_WIDTH_DEFAULT,
  readRailWidth,
  storeRailWidth,
  subscribeRailWidth,
} from "@/lib/workspace-rail";

/**
 * Width of the work-mode rail in px. Server and first client render get the
 * default, so a stored width never causes a hydration mismatch.
 */
function getServerSnapshot(): number {
  return RAIL_WIDTH_DEFAULT;
}

export function useWorkspaceRailWidth() {
  const width = useSyncExternalStore(
    subscribeRailWidth,
    readRailWidth,
    getServerSnapshot,
  );

  const setWidth = useCallback((next: number) => {
    storeRailWidth(next);
  }, []);

  const resetWidth = useCallback(() => {
    storeRailWidth(RAIL_WIDTH_DEFAULT);
  }, []);

  return { width, setWidth, resetWidth };
}
