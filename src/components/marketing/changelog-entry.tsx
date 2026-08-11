import type { ChangelogEntry as Entry } from "@/lib/changelog";
import { formatIsoDate } from "@/lib/format";

/**
 * One entry, rendered the same on the landing page and on `/zmeny` — the date
 * on its own rail on the left, everything a person can now do on the right.
 *
 * The date is the one thing here besides commands and variable names that is
 * set in monospace, which is what makes the rail line up down the whole list
 * without a table.
 */
export function ChangelogEntry({ entry }: { entry: Entry }) {
  return (
    <article className="grid gap-3 py-8 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-10">
      <p className="font-mono text-[0.8125rem] text-muted-foreground sm:pt-1">
        <time dateTime={entry.date}>{formatIsoDate(entry.date)}</time>
      </p>

      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="text-[0.9375rem] font-semibold tracking-[-0.01em]">
            {entry.title}
          </h3>
          {entry.tags?.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
          {entry.items.map((item) => (
            <li key={item} className="relative pl-5">
              <span
                aria-hidden
                className="absolute top-[0.6em] left-0 size-1 rounded-[1px] bg-border"
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
