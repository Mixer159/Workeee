import Link from "next/link";
import { Mark } from "@/components/brand/mark";
import { LICENSE_NAME, REPO_LABEL, REPO_LICENSE_URL, REPO_URL } from "@/lib/repo";

/**
 * The closing bookend.
 *
 * The brand word again, at the same face, weight and tracking as the hero, and
 * cropped by the bottom edge on purpose: the page opens on the word and closes
 * on it, and in between it never appears at that size again. The links under it
 * are the ones a person who read the whole page might still want; nothing they
 * came for is down here.
 */
export function SiteFooter() {
  return (
    <footer className="overflow-hidden">
      <div className="mx-auto max-w-[84rem] px-6 pt-20 lg:px-10 lg:pt-28">
        <div className="flex flex-col gap-6 border-b border-border pb-10 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2.5">
            <Mark className="size-5 text-primary" />
            <span className="font-heading text-sm font-bold tracking-[-0.03em]">
              Workeee
            </span>
          </span>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-muted-foreground">
            <Link
              href="/zmeny"
              className="rounded-sm transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              Změny
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              {REPO_LABEL}
            </a>
            <a
              href={REPO_LICENSE_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              Licence {LICENSE_NAME}
            </a>
          </div>
        </div>
      </div>

      <p
        data-enter
        aria-hidden
        className="workeee-display mt-10 -mb-[0.16em] px-6 text-center text-[clamp(4rem,20vw,18rem)] text-foreground/[0.07] select-none lg:px-10"
      >
        Workeee
      </p>
    </footer>
  );
}
