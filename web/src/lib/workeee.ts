/**
 * Every fact the pages state: numbers, limits, links and commands.
 *
 * The text comes from the app's own public page (workeee.vercel.app/o-aplikaci)
 * and its repository (README, CLAUDE.md, changelog). Nothing here is invented,
 * and it has to change when the app does; see "The website" in the root
 * CLAUDE.md.
 */
import { CHANGELOG, type ChangelogEntry } from "@/lib/changelog";

export const SITE = {
  name: "Workeee",
  title: "Workeee: projekty a úkoly pro tým",
  description:
    "Týmová nástěnka s projekty, úkoly, komentáři a přílohami. Open source pod licencí MIT, nasadíte ji na vlastní Convex a Vercel a za členy týmu neplatíte.",
} as const;

export const LINKS = {
  repo: "https://github.com/Mixer159/Workeee",
  /** The address as a person reads it, without the scheme. */
  repoLabel: "github.com/Mixer159/Workeee",
  issues: "https://github.com/Mixer159/Workeee/issues",
  license: "https://github.com/Mixer159/Workeee/blob/main/LICENSE",
  /** The production app. The pages only link to it. */
  login: "https://workeee.vercel.app/prihlaseni",
} as const;

/**
 * The footer's small print. The repository's LICENSE holds the copyright;
 * this site came in as a contribution, and the paintings are public domain
 * (sources in src/lib/photos.ts).
 */
export const CREDITS = {
  copyright: "© 2026 Maxim Kudela a přispěvatelé",
  website: { label: "Web: Jakub Szydlowski", href: "https://github.com/spsJakubSzydlowski" },
  paintings: "Malby: Vincent van Gogh, volné dílo",
} as const;

/** One label per action, the same on every page. */
export const ACTIONS = {
  repo: "Otevřít na GitHubu",
  deploy: "Nasazení krok za krokem",
  login: "Přihlášení",
  issues: "Issues",
  license: "Licence MIT",
  changelog: "Celá historie",
} as const;

export const HERO = {
  /** Two lines; the second is the one the original site sets in its accent. */
  headline: ["Týmová nástěnka,", "která běží u vás"],
  leadLong:
    "Projekty, úkoly, komentáře a přílohy na jednom místě. Nasadíte si ji na vlastní Convex a Vercel, takže data máte pod kontrolou.",
  claims: [
    "Open source pod licencí MIT",
    "Nasadíte během jednoho odpoledne",
    "Žádné poplatky za členy týmu",
  ],
} as const;

export type Shot = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

/**
 * Screenshots of the running app, all in its default light theme (Obloha).
 * Desktop shots were taken at 1440 x 900 with a 2x pixel ratio, the phone one
 * at 390 wide. The five `feature*` files are tighter crops of single screens.
 */
export const SHOTS = {
  board: {
    src: "/screenshots/board.png",
    width: 2432,
    height: 1120,
    alt: "Nástěnka projektu Web pro Zátiší se sloupci To-do, V průběhu a Hotovo.",
  },
  boardMobile: {
    src: "/screenshots/board-mobile.png",
    width: 780,
    height: 1688,
    alt: "Nástěnka na telefonu.",
  },
  drawer: {
    src: "/screenshots/drawer.png",
    width: 2880,
    height: 1800,
    alt: "Nástěnka s otevřeným panelem úkolu Redesign úvodní sekce vpravo.",
  },
  comments: {
    src: "/screenshots/comments.png",
    width: 1182,
    height: 994,
    alt: "Vlákno komentářů pod úkolem se zmínkou konkrétního člověka.",
  },
  featureStavy: {
    src: "/screenshots/features/stavy.png",
    width: 1792,
    height: 1120,
    alt: "Nástěnka projektu se sloupci To-do, V průběhu a Hotovo.",
  },
  featureRole: {
    src: "/screenshots/features/role.png",
    width: 1456,
    height: 894,
    alt: "Seznam členů organizace s rolemi a rozsahem přístupu.",
  },
  featurePozvanky: {
    src: "/screenshots/features/pozvanky.png",
    width: 1456,
    height: 698,
    alt: "Seznam pozvánek s kódem, stavem a datem vypršení.",
  },
  featureUpozorneni: {
    src: "/screenshots/features/upozorneni-2.png",
    width: 1300,
    height: 812,
    alt: "Stránka Upozornění se zmínkou v komentáři.",
  },
  featureVzhledy: {
    src: "/screenshots/features/vzhledy-2.png",
    width: 701,
    height: 705,
    alt: "Výběr ze šesti barevných vzhledů aplikace.",
  },
} satisfies Record<string, Shot>;

export type Feature = {
  id: string;
  title: string;
  body: string;
  shot: Shot;
};

/** The six things the original site lists under "Co je uvnitř". */
export const FEATURES: Feature[] = [
  {
    id: "stavy",
    title: "Nástěnka s vlastními stavy",
    body: "Každý projekt začne se třemi sloupci. Další si pojmenujete a obarvíte, nejvýš jich je dvanáct.",
    shot: SHOTS.featureStavy,
  },
  {
    id: "role",
    title: "Role a viditelnost",
    body: "Vlastník, správce a člen. Člen vidí celou organizaci, nebo jen projekty, do kterých ho někdo pozval.",
    shot: SHOTS.featureRole,
  },
  {
    id: "pozvanky",
    title: "Pozvánky odkazem",
    body: "Odkaz na jedno použití, platný šest hodin až třicet dnů. Do celé organizace, nebo do jednoho projektu.",
    shot: SHOTS.featurePozvanky,
  },
  {
    id: "prilohy",
    title: "Přílohy a komentáře",
    body: "Soubory do deseti megabajtů u úkolu i v komentáři. Diskuse se neztrácí v e-mailech.",
    shot: SHOTS.comments,
  },
  {
    id: "upozorneni",
    title: "Upozornění po dávkách",
    body: "Přiřazení, zmínka a komentář chodí e-mailem po dávkách: osm změn za sebou je jedna zpráva s počtem v předmětu. V aplikaci je kanál s nepřečtenými nahoře.",
    shot: SHOTS.featureUpozorneni,
  },
  {
    id: "vzhledy",
    title: "Šest vzhledů",
    body: "Tři světlé a tři tmavé palety celé aplikace. Výběr se pamatuje v prohlížeči.",
    shot: SHOTS.featureVzhledy,
  },
];

export const FEATURES_INTRO = {
  title: "Co je uvnitř",
  note: "Žádné makety. Každý snímek obrazovky na této stránce je z běžící aplikace.",
} as const;

/** The screens the "Jak se s Workeee pracuje" steps borrow their text from. */
export const SURFACES: Feature[] = [
  {
    id: "drawer",
    title: "Úkol vedle nástěnky",
    body: "Kliknutí na kartu otevře detail vpravo a nástěnka pod ním dál funguje. Otevřený úkol je v adrese, pošlete ho odkazem.",
    shot: SHOTS.drawer,
  },
  {
    id: "komentare",
    title: "Komentáře se zmínkami",
    body: "Diskuse přímo u úkolu, s přílohami. Zmínka @ jménem pošle dotyčnému upozornění.",
    shot: SHOTS.comments,
  },
];

export type DeployStep = {
  title: string;
  body: string;
  /** Shell lines or variable names. A line starting with "#" is a comment. */
  lines: string[];
};

export const DEPLOY = {
  title: "Nasadíte si to sami",
  lead: "Vlastní Convex, vlastní Vercel, vlastní data. Čtyři kroky a aplikace běží, bez jediného účtu navíc.",
  steps: [
    {
      title: "Naklonovat a nainstalovat",
      body: "Node 20 nebo novější a pnpm. Nic dalšího.",
      lines: [
        "git clone https://github.com/Mixer159/Workeee.git",
        "cd Workeee",
        "pnpm install",
      ],
    },
    {
      title: "Založit deployment Convexu",
      body: "Přihlásí vás, vytvoří projekt a čtyři proměnné zapíše do .env.local samo.",
      lines: ["pnpm exec convex dev"],
    },
    {
      title: "Nastavit tajemství",
      body: "SITE_URL se musí rovnat adrese, ze které aplikaci servírujete. Jinak Better Auth odmítne přihlášení.",
      lines: [
        'pnpm exec convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"',
        "pnpm exec convex env set SITE_URL https://vase-app.vercel.app",
        "# volitelně, jinak se e-maily jen neodesílají",
        "pnpm exec convex env set BREVO_API_KEY xxx",
        "pnpm exec convex env set BREVO_SENDER_EMAIL vy@vase-domena.cz",
      ],
    },
    {
      title: "Nasadit",
      body: "Na Vercel patří jen tři veřejné proměnné. Tajemství zůstávají v Convexu, prohlížeč je nikdy neuvidí.",
      lines: [
        "NEXT_PUBLIC_CONVEX_URL",
        "NEXT_PUBLIC_CONVEX_SITE_URL",
        "NEXT_PUBLIC_SITE_URL",
      ],
    },
  ] satisfies DeployStep[],
} as const;

export const OPEN_SOURCE = {
  title: "Zdrojový kód máte celý",
  body: "Licence MIT, jeden repozitář, žádná uzavřená část. Next.js, Convex a Better Auth; nic dalšího si nikde nezakládáte. Chybí vám něco, nebo jste našli chybu? Založte issue, nebo rovnou pošlete pull request. Kód je psaný tak, aby se v něm dalo číst: každé rozhodnutí, které by jinak vypadalo náhodně, má v repozitáři napsáno proč.",
} as const;

export { CHANGELOG, type ChangelogEntry };

/** The entries a landing page shows before the link to the full history. */
export const LATEST_CHANGES: ChangelogEntry[] = CHANGELOG.slice(0, 4);

export const CHANGES_TITLE = "Poslední změny";

const dateFormat = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-10-05" becomes "5. října 2026". */
export function formatDate(isoDate: string) {
  return dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
}
