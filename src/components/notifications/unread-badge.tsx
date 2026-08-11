import { plural } from "@convex/lib/plural";
import { cn } from "@/lib/utils";

/**
 * The one shape for "there are N unseen things behind this": a small lime tag,
 * used by the rail's notification link, the project rows and the dashboard
 * cards, so a count always looks the same wherever it appears. A tag, not a
 * pill — the only fully round things in this product are a face and a switch.
 *
 * Renders nothing at zero: an explicit "0" would put noise on every quiet row.
 */
export function UnreadBadge({
  count,
  label,
  className,
}: {
  count: number;
  /** What the number means, for assistive tech — e.g. "3 úkoly s něčím novým". */
  label?: string;
  className?: string;
}) {
  if (count <= 0) {
    return null;
  }
  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-md bg-primary/15 px-1 font-mono text-[0.6875rem] font-medium tabular-nums text-primary",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * What a project's number means — tasks with something unseen, not individual
 * events. Shared by the rail and the dashboard so the two never phrase it
 * differently.
 */
export function unreadTasksLabel(count: number): string | undefined {
  if (count <= 0) {
    return undefined;
  }
  return `${count} ${plural(count, "úkol", "úkoly", "úkolů")} s něčím novým`;
}
