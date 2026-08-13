"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  applyTheme,
  readTheme,
  themeAppearance,
  type Theme,
} from "@/lib/theme";

/**
 * Hand-rolled palette store. No next-themes.
 *
 * `data-theme` on <html> is the single source of truth: the pre-hydration
 * script sets it before paint and this hook observes it without an effect.
 */
function subscribe(onStoreChange: () => void): () => void {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getServerSnapshot(): Theme {
  return "sky";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
  }, []);

  return { theme, appearance: themeAppearance(theme), setTheme };
}
