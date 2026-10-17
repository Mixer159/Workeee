import { Mark } from "@/components/shared/mark";
import { tidy } from "@/lib/typography";
import { ACTIONS, HERO, LINKS, SITE } from "@/lib/workeee";
import { externalProps } from "./button-link";
import { CHANGES_HREF, type Page } from "./nav";

function columns(base: string) {
  return [
    {
      title: "Stránka",
      links: [
        { href: `${base}#obrazovky`, label: "Jak to funguje" },
        { href: `${base}#funkce`, label: "Funkce" },
        { href: `${base}#nasazeni`, label: ACTIONS.deploy },
        { href: `${base}#zdrojovy-kod`, label: "Zdrojový kód" },
        { href: CHANGES_HREF, label: "Změny" },
      ],
    },
    {
      title: "Projekt",
      links: [
        { href: LINKS.repo, label: ACTIONS.repo },
        { href: LINKS.issues, label: ACTIONS.issues },
        { href: LINKS.license, label: ACTIONS.license },
        { href: CHANGES_HREF, label: ACTIONS.changelog },
      ],
    },
    { title: "Aplikace", links: [{ href: LINKS.login, label: ACTIONS.login }] },
  ];
}

/**
 * The light grey close of the page, laid out after the footer of the Linky variant:
 * the mark and the three claims, three columns of links, and the name cut
 * off by the bottom edge.
 */
export function Footer({ page = "home" }: { page?: Page }) {
  const COLUMNS = columns(page === "home" ? "" : "/");
  return (
    <footer className="bg-footer text-ink">
      <div className="wrap @container">
        {/* Side by side from 1280 px. Narrower, the link columns would squeeze
            the claims until each of them wraps. */}
        <div className="grid gap-12 pt-16 pb-14 md:pt-20 md:pb-20 xl:grid-cols-[minmax(0,1fr)_auto] xl:gap-20">
          <div>
            <a href="#top" className="inline-flex items-center gap-2.5 text-[1.0625rem] font-semibold tracking-[-0.02em]">
              <Mark className="h-5 w-auto text-ink [&_rect:last-child]:fill-dot" />
              {SITE.name}
            </a>
            <ul role="list" className="mt-5 text-[0.9375rem] leading-7 text-muted">
              {HERO.claims.map((claim) => (
                <li key={claim}>{tidy(claim)}</li>
              ))}
            </ul>
          </div>

          <nav aria-label="Odkazy v patičce" className="grid grid-cols-2 gap-x-10 gap-y-10 sm:grid-cols-3 lg:gap-x-16">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <h2 className="text-[0.9375rem] font-semibold">{column.title}</h2>
                <ul role="list" className="mt-3 space-y-0.5 text-[0.9375rem] text-muted">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <a href={link.href} {...externalProps(link.href)} className="inline-block py-1.5 transition-[color] duration-150 hover:text-ink">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Decoration only: the name is already in the footer as text. The
            word is drawn by CSS from data-word, so contrast checks, which
            would hold the deliberately faint letters to the text minimum,
            leave it alone. */}
        <div aria-hidden="true" className="overflow-hidden">
          <p className="footer-wordmark" data-word="WORKEEE" />
        </div>
      </div>
    </footer>
  );
}
