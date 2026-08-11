import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one shape for "there is nothing here (yet)" and for "this address leads
 * nowhere": a heading, one calm sentence, and the action or link that gets the
 * person moving again. Used by the dashboard, the board, a missing project or
 * task and the 404 page, so all five read the same.
 *
 * The border is dashed and the panel is empty, which is the whole point: it is
 * the only dashed edge in the product, so a dashed edge always means "a place
 * something goes".
 */
export function EmptyState({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      <p className="font-heading text-[0.9375rem] font-semibold tracking-[-0.01em]">
        {title}
      </p>
      {description ? (
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
