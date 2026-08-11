import type { Metadata } from "next";
import { plural } from "@convex/lib/plural";
import { ChangelogEntry } from "@/components/marketing/changelog-entry";
import { CHANGELOG, groupChangelogByMonth } from "@/lib/changelog";
import { formatIsoMonth } from "@/lib/format";

export const metadata: Metadata = {
  title: "Změny",
  description: "Co se ve Workeee změnilo, od nejnovějšího.",
};

/**
 * The whole changelog, grouped by month. Same array and same entry component as
 * the section on the landing page, so the two can never drift apart.
 */
export default function ChangelogPage() {
  const groups = groupChangelogByMonth(CHANGELOG);

  return (
    <div className="mx-auto max-w-[84rem] px-6 py-20 lg:px-10 lg:py-28">
      <h1 className="font-heading text-[clamp(2rem,6vw,4rem)] leading-[1] font-bold tracking-[-0.04em]">
        Změny
      </h1>
      <p className="mt-6 max-w-[44rem] text-[0.9375rem] leading-relaxed text-muted-foreground">
        Co se v aplikaci změnilo, od nejnovějšího. Seznam je součástí
        repozitáře, takže se mění spolu s kódem.
      </p>

      <div className="mt-16 flex flex-col gap-16">
        {groups.map((group) => (
          <section key={group.month}>
            <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
              <h2 className="font-heading text-[0.9375rem] font-semibold tracking-[-0.01em]">
                {monthHeading(group.month)}
              </h2>
              <p className="font-mono text-xs text-muted-foreground">
                {group.entries.length}{" "}
                {plural(group.entries.length, "změna", "změny", "změn")}
              </p>
            </div>

            <div className="divide-y divide-border">
              {group.entries.map((entry) => (
                <ChangelogEntry
                  key={`${entry.date}-${entry.title}`}
                  entry={entry}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * `Intl` gives Czech month names in lower case, which is right inside a
 * sentence and wrong as the first word of a heading.
 */
function monthHeading(month: string): string {
  const name = formatIsoMonth(month);
  return name.charAt(0).toUpperCase() + name.slice(1);
}
