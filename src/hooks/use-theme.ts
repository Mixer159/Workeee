"use client";

import { useCallback, useSyncExternalStore } from "react";
import { applyTheme, readTheme, type Theme } from "@/lib/theme";

/**
 * Hand-rolled class-based dark mode. No next-themes.
 *
 * The `dark` class on <html> is the single source of truth: it is set by the
 * pre-hydration script in the root layout and observed here, so any code that
 * flips the class stays in sync.
 */
function subscribe(onStoreChange: () => void): () => void {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getServerSnapshot(): Theme {
  return "light";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(readTheme() === "dark" ? "light" : "dark");
  }, []);

  return { theme, setTheme, toggleTheme };
}
