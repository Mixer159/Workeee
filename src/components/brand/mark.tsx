import { cn } from "@/lib/utils";

/**
 * The mark, drawn once and used by both surfaces: the rail, the auth and
 * invite screens, the 404, and the public page's header and footer.
 *
 * Here it is the bare glyph in `currentColor` and never the tile from
 * `src/app/icon.svg` — a tile only exists so a favicon has a field to sit on,
 * and inside the product the mark should take the color of whatever it sits
 * next to. The path is the same four shapes; the two files change together.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 44"
      aria-hidden
      focusable="false"
      className={cn("size-5 shrink-0", className)}
      fill="currentColor"
    >
      <rect x="0" y="0" width="12" height="44" rx="3" />
      <rect x="18" y="14" width="12" height="30" rx="3" />
      <rect x="36" y="28" width="12" height="16" rx="3" />
      <rect x="36" y="10" width="12" height="10" rx="3" />
    </svg>
  );
}
