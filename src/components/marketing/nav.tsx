import { Mark } from "@/components/brand/mark";
import { AppLink } from "./app-link";
import { NavMenu, type NavLink } from "./nav-menu";

/** Where the landing page and the changelog page live. */
export const HOME_HREF = "/o-aplikaci";
export const CHANGES_HREF = "/zmeny";

/** On the landing page the sections are in-page anchors; elsewhere they lead back to it. */
export type Page = "home" | "zmeny";

const SECTIONS = [
  { hash: "#obrazovky", label: "Jak to funguje" },
  { hash: "#funkce", label: "Funkce" },
  { hash: "#nasazeni", label: "Nasazení" },
  { hash: "#zdrojovy-kod", label: "Zdrojový kód" },
];

/**
 * The floating bar: a dark rounded rectangle, centred. It starts inside the
 * hero sheet and scrolls with the page until it is 12 px from the top, where
 * it stays for the rest of the page (see .nav-rail in marketing.css). It is opaque, so its text reads over the photograph, over the
 * light sections and over a dark frame (the thin light ring marks its edge
 * there). Below 1024 px (phones and upright tablets) the links move into a
 * burger menu beside the login, and the bar spans the window up to 26rem.
 * Its 18 px margins keep it 8 px inside the white sheet's sides, as it is
 * 8 px below the sheet's top edge.
 * The header itself lets clicks through, only the bar takes them.
 */
export function Nav({ page = "home" }: { page?: Page }) {
  const base = page === "home" ? "" : HOME_HREF;
  const links: NavLink[] = [
    ...SECTIONS.map((section) => ({ href: base + section.hash, label: section.label, current: false })),
    { href: CHANGES_HREF, label: "Změny", current: page === "zmeny" },
  ];
  return (
    <header className="pointer-events-none nav-rail sticky top-3 z-50 flex h-0 items-start justify-center px-[1.125rem]">
      <nav
        aria-label="Hlavní"
        className="pointer-events-auto relative flex w-full max-w-[26rem] items-center gap-1 rounded-site-control bg-site-ink p-1 text-white shadow-site-bar ring-1 ring-white/20 [--focus:#ffffff] lg:w-auto lg:max-w-none"
      >
        <a
          href={page === "home" ? "#top" : HOME_HREF}
          aria-label={page === "home" ? "Workeee, začátek stránky" : "Workeee, úvodní stránka"}
          className="flex h-10 items-center gap-2.5 rounded-site-inset px-3 transition-[background-color] duration-200 ease-out hover:bg-white/10 lg:px-4"
        >
          <Mark className="h-5 w-auto text-white [&_rect:last-child]:fill-site-dot" />
          <span className="text-[1.0625rem] font-semibold tracking-[-0.01em]">Workeee</span>
        </a>

        <ul className="hidden items-center lg:mx-2 lg:flex">
          {links.map((section) => (
            <li key={section.href}>
              <a
                href={section.href}
                aria-current={section.current ? "page" : undefined}
                className="flex h-10 items-center rounded-site-inset px-3.5 text-[0.9375rem] lg:px-5 font-medium whitespace-nowrap text-[#dadde3] transition-[background-color,color] duration-200 ease-out hover:bg-white/10 hover:text-white aria-[current=page]:text-white"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>

        {/* The slot stays while the session is checked, so the burger never moves. */}
        <span className="mr-1 ml-auto flex lg:ml-3">
          <AppLink className="flex h-[34px] items-center rounded-[7px] bg-white px-3.5 text-[0.90625rem] font-semibold text-site-ink transition-[background-color] duration-200 ease-out hover:bg-[#e3f1ec] lg:px-[1.125rem]" />
        </span>

        <NavMenu links={links} />
      </nav>
    </header>
  );
}
