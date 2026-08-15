import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { ChangelogEntry } from "@/components/marketing/changelog-entry";
import { CHANGELOG, CHANGELOG_PREVIEW_COUNT } from "@/lib/changelog";

/**
 * The landing page\'s slice of the changelog: the newest few, then the way to
 * the rest. Both this and `/zmeny` read the same array, so the page can never
 * show something the full list does not have.
 */
export function ChangelogSection() {
  const entries = CHANGELOG.slice(0, CHANGELOG_PREVIEW_COUNT);

  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[84rem] px-6 py-24 lg:px-10 lg:py-36">
        <h2
          data-enter
          className="font-heading text-[clamp(1.75rem,4.2vw,3rem)] leading-[1.05] font-bold tracking-[-0.035em]"
        >
          Poslední změny
        </h2>

        <div
          data-enter-stagger
          className="mt-12 divide-y divide-border border-t border-border"
        >
          {entries.map((entry) => (
            <ChangelogEntry key={`${entry.date}-${entry.title}`} entry={entry} />
          ))}
        </div>

        <Link
          href="/zmeny"
          className="mt-10 inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          Celá historie
          <ArrowRightIcon className="size-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
