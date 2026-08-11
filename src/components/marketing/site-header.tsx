import Link from "next/link";
import { AppLink } from "@/components/marketing/app-link";
import { Mark } from "@/components/brand/mark";

/**
 * One hairline row, and nothing in it competes with the page.
 *
 * There is deliberately no "Otevřít na GitHubu" here: the page's one action
 * appears twice, in the hero and at the end of the open-source section, and a
 * third copy in a bar that follows the reader down the page would make it
 * three.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[84rem] items-center gap-8 px-6 lg:px-10">
        <Link
          href="/o-aplikaci"
          className="flex items-center gap-2.5 rounded-md transition-opacity outline-none hover:opacity-70 focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <Mark className="size-5 text-primary" />
          <span className="font-heading text-[0.9375rem] font-bold tracking-[-0.03em]">
            Workeee
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-6">
          <Link
            href="/zmeny"
            className="rounded-md text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            Změny
          </Link>
          <AppLink />
        </nav>
      </div>
    </header>
  );
}
