import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one shape for "there is nothing here (yet)" and for "this address leads
 * nowhere": a heading, one calm sentence, and the action or link that gets the
 * person moving again. Used by the dashboard, the board, a missing project or
 * task and the 404 page, so all four read the same.
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
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      <p className="font-heading text-base font-semibold">{title}</p>
      {description ? (
        <p className="max-w-prose text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}
