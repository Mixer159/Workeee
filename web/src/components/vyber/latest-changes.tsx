import { ArrowIcon } from "@/components/shared/icons";
import { tidy } from "@/lib/typography";
import { ACTIONS, CHANGES_TITLE, formatDate, LATEST_CHANGES } from "@/lib/workeee";
import { TextLink } from "./button-link";
import { CHANGES_HREF } from "./nav";
import { Typo } from "./typo";

/**
 * The last section of the page: the four newest entries of the changelog,
 * each with its date, the part of the app it is about, its title and its
 * first point, and the link to the whole history on /zmeny.
 */
export function LatestChanges() {
  return (
    <section id="posledni-zmeny" aria-labelledby="posledni-zmeny-title" className="wrap pt-20 pb-6 lg:pt-28 lg:pb-10">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
        <h2 id="posledni-zmeny-title" className="display-section">
          {CHANGES_TITLE}
        </h2>
        <TextLink href={CHANGES_HREF}>
          {ACTIONS.changelog}
          <ArrowIcon className="size-4" />
        </TextLink>
      </div>

      <ol className="mt-10 grid gap-x-16 gap-y-10 md:grid-cols-2 lg:mt-12 lg:gap-y-12">
        {LATEST_CHANGES.map((entry) => (
          <li key={`${entry.date}-${entry.title}`}>
            <article>
              <p className="text-[0.9375rem] text-muted">
                <time dateTime={entry.date}>{formatDate(entry.date)}</time>
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
              <p className="mt-2.5 max-w-[34rem] leading-relaxed text-pretty text-muted">
                <Typo>{entry.items[0]}</Typo>
              </p>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
