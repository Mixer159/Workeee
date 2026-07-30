import { cn } from "@/lib/utils";

/**
 * A project's icon, in the order the server guarantees is unambiguous: an
 * uploaded image, else the chosen emoji, else a deterministic tile with the
 * project's first letter. The tile palette follows the repo's alpha convention,
 * so both themes work without a `dark:` background variant.
 */
const TILE_CLASSES = [
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300",
];

function tileClass(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 1000003;
  }
  return TILE_CLASSES[hash % TILE_CLASSES.length];
}

export function ProjectIcon({
  seed,
  name,
  emoji,
  iconUrl,
  className,
}: {
  seed: string;
  name: string;
  emoji?: string | null;
  iconUrl?: string | null;
  className?: string;
}) {
  const shape = cn(
    "flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-md text-[0.65rem] font-semibold uppercase",
    className,
  );

  if (iconUrl) {
    return (
      // Convex storage URLs are signed and short-lived, so they are not worth
      // routing through the Next image optimizer.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={iconUrl} alt="" className={cn(shape, "object-cover")} />
    );
  }

  if (emoji) {
    return (
      // The emoji carries its own type size — a glyph needs more room than a
      // single letter — but it is written before `className`, so a caller that
      // renders a bigger tile still decides.
      <span
        aria-hidden
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md text-[0.9rem] leading-none",
          className,
        )}
      >
        {emoji}
      </span>
    );
  }

  return (
    <span aria-hidden className={cn(shape, tileClass(seed))}>
      {name.trim().charAt(0) || "?"}
    </span>
  );
}
