export const THEMES = [
  {
    id: "sky",
    label: "Obloha",
    description: "Vzdušná modrá",
    appearance: "light",
    preview: ["hsl(216 45% 97%)", "hsl(224 76% 43%)"],
  },
  {
    id: "lilac",
    label: "Šeřík",
    description: "Jemná fialová",
    appearance: "light",
    preview: ["hsl(270 45% 97%)", "hsl(268 58% 43%)"],
  },
  {
    id: "sand",
    label: "Písek",
    description: "Teplá béžová",
    appearance: "light",
    preview: ["hsl(38 45% 96%)", "hsl(12 68% 40%)"],
  },
  {
    id: "dusk",
    label: "Soumrak",
    description: "Tlumená modrá",
    appearance: "dark",
    preview: ["hsl(224 22% 12%)", "hsl(196 88% 65%)"],
  },
  {
    id: "forest",
    label: "Les",
    description: "Hluboká zelená",
    appearance: "dark",
    preview: ["hsl(160 23% 12%)", "hsl(154 65% 62%)"],
  },
  {
    id: "plum",
    label: "Švestka",
    description: "Temná růžová",
    appearance: "dark",
    preview: ["hsl(300 18% 13%)", "hsl(328 78% 70%)"],
  },
] as const;

export type Theme = (typeof THEMES)[number]["id"];
export type ThemeAppearance = (typeof THEMES)[number]["appearance"];

export const DEFAULT_LIGHT_THEME: Theme = "sky";
export const DEFAULT_DARK_THEME: Theme = "dusk";
export const THEME_STORAGE_KEY = "workeee-theme";

const THEME_IDS = new Set<string>(THEMES.map((theme) => theme.id));
const DARK_THEME_IDS = THEMES.filter(
  (theme) => theme.appearance === "dark",
).map((theme) => theme.id);

export function isTheme(value: string | null): value is Theme {
  return value !== null && THEME_IDS.has(value);
}

export function getTheme(theme: Theme) {
  return THEMES.find((item) => item.id === theme) ?? THEMES[0];
}

export function themeAppearance(theme: Theme): ThemeAppearance {
  return getTheme(theme).appearance;
}

/**
 * Inline, pre-hydration theme script. Runs before first paint so a stored
 * palette never flashes through the light default. Keep in sync with
 * `applyTheme` below.
 *
 * `light` and `dark` are legacy values from the old binary switch. Mapping
 * them here keeps every existing preference valid after the upgrade.
 */
export const themeInitScript = `(function(){try{var k="${THEME_STORAGE_KEY}",t=localStorage.getItem(k),v=[${THEMES.map((theme) => `"${theme.id}"`).join(",")}],x=[${DARK_THEME_IDS.map((theme) => `"${theme}"`).join(",")}];if(t==="light")t="${DEFAULT_LIGHT_THEME}";if(t==="dark")t="${DEFAULT_DARK_THEME}";if(v.indexOf(t)<0)t=window.matchMedia("(prefers-color-scheme: dark)").matches?"${DEFAULT_DARK_THEME}":"${DEFAULT_LIGHT_THEME}";var d=document.documentElement,a=x.indexOf(t)>=0;d.dataset.theme=t;d.classList.toggle("dark",a);d.style.colorScheme=a?"dark":"light";localStorage.setItem(k,t);}catch(e){}})();`;

export function readTheme(): Theme {
  if (typeof document === "undefined") {
    return DEFAULT_LIGHT_THEME;
  }
  const value = document.documentElement.dataset.theme ?? null;
  if (isTheme(value)) {
    return value;
  }
  return document.documentElement.classList.contains("dark")
    ? DEFAULT_DARK_THEME
    : DEFAULT_LIGHT_THEME;
}

export function applyTheme(theme: Theme): void {
  const appearance = themeAppearance(theme);
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", appearance === "dark");
  document.documentElement.style.colorScheme = appearance;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (private mode) — the theme still applies for this session.
  }
}
