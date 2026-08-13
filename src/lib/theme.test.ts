import { describe, expect, it } from "vitest";
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  THEMES,
  isTheme,
  themeAppearance,
} from "@/lib/theme";

describe("themes", () => {
  it("offers an equal number of light and dark palettes", () => {
    expect(THEMES.filter((theme) => theme.appearance === "light")).toHaveLength(3);
    expect(THEMES.filter((theme) => theme.appearance === "dark")).toHaveLength(3);
  });

  it("has unique ids and recognizes only selectable palettes", () => {
    const ids = THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((theme) => isTheme(theme))).toBe(true);
    expect(isTheme("dark")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it("keeps both preference fallbacks on the expected appearance", () => {
    expect(themeAppearance(DEFAULT_LIGHT_THEME)).toBe("light");
    expect(themeAppearance(DEFAULT_DARK_THEME)).toBe("dark");
  });
});
