import Image from "next/image";
import type { Shot as ShotData } from "@/lib/shots";
import { cn } from "@/lib/utils";

/**
 * A screenshot of the running app, framed the way the app frames its own
 * panels: one hairline and a 12 px corner. Nothing else. No window chrome, no
 * invented address bar, no drop shadow pretending the picture is floating above
 * the page it was taken from.
 *
 * `sizes` is not optional in practice. These files are 2880 px wide because
 * they were taken at 2×, and without it Next serves the full one to a phone.
 */
export function Shot({
  shot,
  className,
  imageClassName,
  sizes,
  priority = false,
  crop = false,
}: {
  shot: ShotData;
  className?: string;
  imageClassName?: string;
  sizes: string;
  priority?: boolean;
  /**
   * Fill the frame from the top instead of keeping the file's own aspect.
   *
   * Three captures sit next to each other in the facts grid and they are a
   * portrait, a landscape and a square, so left to their own ratios the row
   * came out as three different heights with three captions at three different
   * altitudes. Cropping from the top keeps the part of each screen the caption
   * is about.
   */
  crop?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      <Image
        src={shot.src}
        alt={shot.alt}
        width={shot.width}
        height={shot.height}
        sizes={sizes}
        priority={priority}
        className={cn(
          crop ? "h-full w-full object-cover object-top" : "h-auto w-full",
          imageClassName,
        )}
      />
    </div>
  );
}
