import { CHANGELOG, groupChangelogByMonth } from "@/lib/changelog";
import { tidy } from "@/lib/typography";
import { PageHead } from "./page-head";
import { Typo } from "./typo";

const dayFormat = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const monthFormat = new Intl.DateTimeFormat("cs-CZ", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const plural = new Intl.PluralRules("cs");

/** "2026-10-05" becomes "5. 10. 2026". */
function formatDay(isoDate: string) {
  return dayFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

/** "2026-10" becomes "Říjen 2026". */
function formatMonth(isoMonth: string) {
  const text = monthFormat.format(new Date(`${isoMonth}-01T00:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** 1 změna, 2 až 4 změny, 5 a víc změn. */
function countChanges(count: number) {
  const word = { one: "změna", few: "změny" }[plural.select(count) as "one" | "few"] ?? "změn";
  return `${count} ${word}`;
}

/**
 * The whole changelog, grouped by month, newest first. From 1024 px up the
 * month and its count stay in view on the left while its changes pass on the
 * right.
 */
export function ChangesPage() {
  const groups = groupChangelogByMonth(CHANGELOG);

  return (
    <>
      <PageHead
        title="Změny"
        lead="Co se v aplikaci změnilo, od nejnovějšího. Seznam je součástí repozitáře, takže se mění spolu s kódem."
      />
      <div className="wrap pb-24 lg:pb-32">
        {groups.map((group) => (
          <section
            key={group.month}
            id={`mesic-${group.month}`}
            aria-labelledby={`mesic-${group.month}-title`}
            className="grid gap-8 border-t border-ink/10 py-12 first:border-t-0 first:pt-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16 lg:py-16"
          >
            <div>
              <div className="lg:sticky lg:top-24">
                <h2
                  id={`mesic-${group.month}-title`}
                  className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em]"
                >
                  {formatMonth(group.month)}
                </h2>
                <p className="mt-1.5 text-muted tabular-nums">{countChanges(group.entries.length)}</p>
              </div>
            </div>

            <ol className="flex flex-col gap-11">
              {group.entries.map((entry) => (
                <li key={`${entry.date}-${entry.title}`}>
                  <article>
                    <p className="text-[0.9375rem] text-muted tabular-nums">
                      <time dateTime={entry.date}>{formatDay(entry.date)}</time>
                      {entry.tags?.map((tag) => (
                        <span key={tag}>
                          <span aria-hidden="true"> · </span>
                          <span className="font-semibold text-deep">{tag}</span>
                        </span>
                      ))}
                    </p>
                    <h3 className="mt-1.5 text-xl leading-snug font-semibold tracking-[-0.015em] sm:text-[1.375rem]">
                      {tidy(entry.title)}
                    </h3>
                    <ul className="mt-3.5 max-w-[46rem] list-disc space-y-2 pl-5 leading-relaxed text-pretty text-muted marker:text-dot">
                      {entry.items.map((item) => (
                        <li key={item}>
                          <Typo>{item}</Typo>
                        </li>
                      ))}
                    </ul>
                  </article>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </>
  );
}
