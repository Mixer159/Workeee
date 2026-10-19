import Image from "next/image";

/**
 * Five logos, each linking to its site. The files are 500 x 200 with a
 * transparent ground and come from chciweeeb.cz/loga. The heading claims
 * these companies use Workeee: the owner confirmed on 2026-10-19 that they do
 * and that they agreed to be shown. A logo added here needs the same.
 */
const LOGOS = [
  { name: "Fitboost", file: "fitboost", href: "https://fitboost.me" },
  { name: "Hotově hned", file: "hotovehned", href: "https://hotovehned.cz" },
  { name: "Úvěr se zástavou", file: "uversezastavou", href: "https://uversezastavou.cz" },
  { name: "Rendio", file: "rendio", href: "https://rendio.cz" },
  { name: "Hypolimit.cz", file: "hypolimit", href: "https://hypolimit.cz" },
];

function LogoList({ copy }: { copy?: boolean }) {
  return (
    // The copies only fill the loop: hidden from assistive technology
    // and out of the tab order, so each logo is announced and focused once.
    <ul className="marquee-list" aria-hidden={copy || undefined}>
      {LOGOS.map((logo) => (
        <li key={logo.file}>
          <a
            href={logo.href}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={copy ? -1 : undefined}
            className="logo-link block rounded-site-inset"
          >
            <Image
              src={`/marketing/loga/${logo.file}.png`}
              alt={logo.name}
              width={500}
              height={200}
              sizes="160px"
              className="h-12 w-auto md:h-14"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The logos under the hero as an endless band. The list is there four times
 * (one list is narrower than a wide screen) and the track moves left by
 * exactly one list, so the loop has no seam. It pauses while the pointer or
 * the keyboard focus is on it, and stands still as one centred list when the
 * system asks for reduced motion (see .marquee in marketing.css). The logo files
 * carry a transparent margin of about 35 % of their height above and below
 * the artwork, so the band's own padding stays small.
 */
export function Logos() {
  return (
    <section aria-labelledby="loga-title" className="bg-site-surface pt-8 lg:pt-10">
      <h2 id="loga-title" className="wrap text-center text-[0.9375rem] font-medium text-site-muted">
        Workeee používají
      </h2>
      <div className="marquee mt-2">
        <div className="marquee-track">
          <LogoList />
          <LogoList copy />
          <LogoList copy />
          <LogoList copy />
        </div>
      </div>
    </section>
  );
}
