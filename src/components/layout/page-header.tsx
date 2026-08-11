import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The top of every screen inside the shell: a title, optionally something to
 * its left (a project's icon), optionally an action on the right, and a
 * hairline under all of it.
 *
 * It exists so the four screens cannot disagree about how big a page title is.
 * The rule of the ramp: exactly one 28 px line per screen, and everything else
 * on it is 15 px or smaller. That contrast is the hierarchy; nothing in between
 * competes.
 */
export function PageHeader({
  title,
  leading,
  actions,
  className,
}: {
  title: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 border-b border-border pb-5",
        className,
      )}
    >
      {leading}
      <h1 className="font-heading text-[1.75rem] leading-none font-bold tracking-[-0.03em]">
        {title}
      </h1>
      {actions ? (
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
