import { cn } from "@/lib/utils";

/**
 * A project's icon, in the order the server guarantees is unambiguous: an
 * uploaded image or SVG, else the chosen emoji, else a graphite chip with the
 * project's first letter.
 *
 * The fallback is deliberately monochrome. A deterministic color per project
 * would put a sixth, seventh and eighth hue on a screen that already spends its
 * color on task statuses and its one accent on the brand, and it would say
 * something about the project that nobody chose. A project that wants an
 * identity gets one three ways, all of them explicit.
 */
export function ProjectIcon({
  name,
  emoji,
  iconUrl,
  className,
}: {
  name: string;
  emoji?: string | null;
  iconUrl?: string | null;
  className?: string;
}) {
  // One chip for all three kinds. An emoji used to be rendered bare, and half
  // of them (🔧, 📱, anything grey) are dark glyphs — on a near-black page that
  // is not a quiet icon, it is an invisible one. The chip is the container that
  // makes any glyph read, and it also stops the three kinds from being three
  // different shapes in the same list.
  const shape = cn(
    "flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-[0.625rem] font-semibold uppercase ring-1 ring-border",
    className,
  );

  if (iconUrl) {
    return (
      // Convex storage URLs are signed and short-lived, so they are not worth
      // routing through the Next image optimizer.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={iconUrl} alt="" className={cn(shape, "bg-transparent object-cover")} />
    );
  }

  if (emoji) {
    return (
      // The emoji carries its own type size — a glyph needs more room than a
      // single letter — but it is written before `className`, so a caller that
      // renders a bigger tile still decides.
      <span aria-hidden className={cn(shape, "text-[0.8em] leading-none")}>
        {emoji}
      </span>
    );
  }

  return (
    <span aria-hidden className={cn(shape, "text-muted-foreground")}>
      {name.trim().charAt(0) || "?"}
    </span>
  );
}
