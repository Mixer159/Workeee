/**
 * Every fact and every sentence the design variants share.
 *
 * The text comes from the original site (workeeeweb.vercel.app), the app's own
 * public page (workeee.vercel.app/o-aplikaci) and its repository
 * (github.com/Mixer159/Workeee: README, CLAUDE.md, changelog). Nothing here is
 * invented. A variant may write its own headings and intros, but numbers,
 * limits, links and commands are read from this file so they are the same on
 * every page.
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
  app: "https://workeee.vercel.app",
  login: "https://workeee.vercel.app/prihlaseni",
  /** Full changelog on the original site. */
  changelog: "https://workeeeweb.vercel.app/zmeny",
} as const;

/** One label per action, the same on every variant. */
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
  lead: "Projekty, úkoly, komentáře a přílohy na jednom místě.",
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
  editor: {
    src: "/screenshots/editor.png",
    width: 1186,
    height: 1730,
    alt: "Popis úkolu s otevřenou nabídkou bloků po napsání lomítka.",
  },
  prace: {
    src: "/screenshots/prace.png",
    width: 2880,
    height: 1800,
    alt: "Pracovní režim: úkoly napříč projekty vlevo, otevřený detail úkolu uprostřed.",
  },
  palette: {
    src: "/screenshots/palette.png",
    width: 2880,
    height: 1800,
    alt: "Příkazová paleta s posledními úkoly nad ztlumeným pracovním režimem.",
  },
  comments: {
    src: "/screenshots/comments.png",
    width: 1182,
    height: 994,
    alt: "Vlákno komentářů pod úkolem se zmínkou konkrétního člověka.",
  },
  upozorneni: {
    src: "/screenshots/upozorneni.png",
    width: 2880,
    height: 1800,
    alt: "Přehled upozornění: zmínka v komentáři od Marka u úkolu Galerie realizací s lazy loadingem.",
  },
  prehled: {
    src: "/screenshots/prehled.png",
    width: 2880,
    height: 1800,
    alt: "Přehled projektů organizace jako karty.",
  },
  vzhledy: {
    src: "/screenshots/vzhledy.png",
    width: 510,
    height: 780,
    alt: "Nabídka uživatele s výběrem šesti vzhledů od Oblohy po Švestku.",
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
  note: "Žádné makety. Každý obrázek na této stránce je snímek běžící aplikace.",
} as const;

/**
 * The four screens a person works in all day, from the app's own public page
 * ("Podívejte se dovnitř").
 */
export const SURFACES: Feature[] = [
  {
    id: "drawer",
    title: "Úkol vedle nástěnky",
    body: "Kliknutí na kartu otevře detail vpravo a nástěnka pod ním dál funguje. Otevřený úkol je v adrese, pošlete ho odkazem.",
    shot: SHOTS.drawer,
  },
  {
    id: "editor",
    title: "Popis jako dokument",
    body: "Blokový editor s nadpisy, seznamy a obrázky. Lomítko otevře nabídku bloků a ukládá se sám.",
    shot: SHOTS.editor,
  },
  {
    id: "prace",
    title: "Pracovní režim",
    body: "Nejnovější úkoly ze všech projektů a organizací v jednom panelu. Otevřený úkol upravujete vedle něj.",
    shot: SHOTS.prace,
  },
  {
    id: "komentare",
    title: "Komentáře se zmínkami",
    body: "Diskuse přímo u úkolu, s přílohami. Zmínka @ jménem pošle dotyčnému upozornění.",
    shot: SHOTS.comments,
  },
];

/** Smaller capabilities, each taken from a changelog entry. Bots have no capture. */
export const EXTRAS: (Omit<Feature, "shot"> & { shot?: Shot })[] = [
  {
    id: "paleta",
    title: "Nový úkol přes ⌘K",
    body: "V pracovním režimu založíte úkol z klávesnice: vyberete projekt a napíšete název.",
    shot: SHOTS.palette,
  },
  {
    id: "boti",
    title: "Boti přes MCP",
    body: "Bot se připojí osobním API tokenem přes MCP server. Zakládá a přesouvá úkoly, přiřazuje je a píše komentáře pod svým jménem a nikdy nesmí víc než jeho vlastník.",
  },
  {
    id: "kanal",
    title: "Nepřečtené na jednom místě",
    body: "Stránka Upozornění sbírá nové úkoly, přiřazení, zmínky a komentáře. Karta úkolu ukazuje počet nepřečtených komentářů.",
    shot: SHOTS.upozorneni,
  },
  {
    id: "prehled",
    title: "Přehled projektů",
    body: "Projekty organizace jako karty. U každého je vidět, v kolika úkolech je něco nového.",
    shot: SHOTS.prehled,
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
  /** The same paragraph as separate statements, for layouts that list them. */
  points: [
    "Licence MIT, jeden repozitář, žádná uzavřená část.",
    "Next.js, Convex a Better Auth; nic dalšího si nikde nezakládáte.",
    "Chybí vám něco, nebo jste našli chybu? Založte issue, nebo rovnou pošlete pull request.",
    "Každé rozhodnutí, které by jinak vypadalo náhodně, má v repozitáři napsáno proč.",
  ],
} as const;

/** What the app is built on, with the job each part does (from the README). */
export const STACK = [
  { name: "Next.js", role: "frontend" },
  { name: "Convex", role: "databáze, serverové funkce a úložiště" },
  { name: "Better Auth", role: "registrace, přihlášení a relace" },
  { name: "Vercel", role: "hosting frontendu" },
  { name: "Tailwind CSS", role: "styly" },
  { name: "TypeScript", role: "jazyk" },
] as const;

/** Limits and counts stated on the original site, for layouts that set numbers large. */
export const NUMBERS = [
  { value: "3", label: "sloupce, se kterými začne každý projekt" },
  { value: "12", label: "stavů nejvýš na jedné nástěnce" },
  { value: "10 MB", label: "na soubor u úkolu i v komentáři" },
  { value: "6 h až 30 dnů", label: "platnost jednorázové pozvánky" },
  { value: "8 = 1", label: "osm změn za sebou je jeden e-mail" },
  { value: "6", label: "vzhledů, tři světlé a tři tmavé" },
  { value: "4", label: "kroky od klonu po nasazení" },
  { value: "MIT", label: "licence celého repozitáře" },
] as const;

/** The three roles, as the access model in the repository defines them. */
export const ROLES = [
  {
    name: "Vlastník",
    body: "Spravuje organizaci, členy, pozvánky a nastavení projektů. Jako jediný smí organizaci smazat a předat roli vlastníka dál.",
  },
  {
    name: "Správce",
    body: "Spravuje nastavení organizace, členy, pozvánky a nastavení projektů. Organizaci vede, ale smazat ji nemůže.",
  },
  {
    name: "Člen",
    body: "Pracuje s úkoly a stavy na nástěnce. Vidí celou organizaci, nebo jen projekty, do kterých ho někdo pozval.",
  },
] as const;

/**
 * Who may do what, row by row, in the order of ROLES. From the access model:
 * the board is a shared working surface, owners and admins manage, and only an
 * owner hands out the owner role or deletes the organization.
 */
export const ROLE_MATRIX = {
  note: "Kdo organizaci založí, je její vlastník.",
  rows: [
    { capability: "Úkoly a stavy na nástěnce", allowed: [true, true, true] },
    { capability: "Nastavení organizace a projektů", allowed: [true, true, false] },
    { capability: "Členové a pozvánky", allowed: [true, true, false] },
    { capability: "Předání role vlastníka", allowed: [true, false, false] },
    { capability: "Smazání organizace", allowed: [true, false, false] },
  ],
} as const;

/** Questions a visitor has, each answered by a fact from the sources above. */
export const FAQ = [
  {
    question: "Kolik stojí další člen týmu?",
    answer: "Nic. Workeee je open source pod licencí MIT a za členy týmu se neplatí.",
  },
  {
    question: "Kde jsou naše data?",
    answer: "Ve vašem vlastním deploymentu Convexu. Frontend běží na vašem Vercelu.",
  },
  {
    question: "Co potřebuji k nasazení?",
    answer: "Node 20 nebo novější a pnpm. Čtyři kroky a aplikace běží, bez jediného účtu navíc.",
  },
  {
    question: "Jak pozvu kolegy?",
    answer: "Odkazem na jedno použití, platným šest hodin až třicet dnů. Do celé organizace, nebo do jednoho projektu.",
  },
  {
    question: "Kdo co vidí?",
    answer: "Role jsou vlastník, správce a člen. Člen vidí celou organizaci, nebo jen projekty, do kterých ho někdo pozval.",
  },
  {
    question: "Jak velké soubory lze přiložit?",
    answer: "Do deseti megabajtů, u úkolu i v komentáři.",
  },
  {
    question: "Chodí upozornění e-mailem?",
    answer: "Ano, po dávkách: osm změn za sebou je jedna zpráva. Odesílání přes Brevo je volitelné, bez něj se e-maily jen neodesílají.",
  },
  {
    question: "Dá se změnit vzhled?",
    answer: "Šest vzhledů, tři světlé a tři tmavé. Výběr se pamatuje v prohlížeči.",
  },
  {
    question: "Můžu si aplikaci upravit?",
    answer: "Ano. Jeden repozitář pod licencí MIT, žádná uzavřená část. Issues i pull requesty jsou vítané.",
  },
] as const;

/**
 * The demo content visible in the real screenshots, for HTML recreations of
 * the board. Use it instead of inventing tasks or people, so a rebuilt board
 * matches the captures next to it. Status colours are the app's own defaults.
 */
export const DEMO = {
  organization: "Rovina",
  project: "Web pro Zátiší",
  people: [
    { name: "Tereza Havlíčková", initials: "TH" },
    { name: "Marek Doubrava", initials: "MD" },
  ],
  columns: [
    {
      name: "To-do",
      color: "#6b7280",
      tasks: [
        { title: "Přepsat texty na stránce o nás" },
        { title: "Vyladit kontrast v patičce", assignee: "MD" },
        { title: "Doplnit alt texty k fotkám z ateliéru" },
        { title: "Připravit 404 stránku", assignee: "TH" },
        { title: "Sjednotit velikosti nadpisů napříč sekcemi" },
        { title: "Export loga ve formátu SVG" },
      ],
    },
    {
      name: "V průběhu",
      color: "#3b82f6",
      tasks: [
        { title: "Redesign úvodní sekce", assignee: "MD" },
        { title: "Napojit formulář na e-mail", assignee: "MD" },
        { title: "Galerie realizací s lazy loadingem", assignee: "TH" },
      ],
    },
    {
      name: "Hotovo",
      color: "#22c55e",
      tasks: [
        { title: "Nasadit staging na Vercel" },
        { title: "Vybrat typografii" },
        { title: "Nastavit doménu a certifikát" },
        { title: "Základní layout" },
      ],
    },
  ],
  /** The nine colours a custom status can take. */
  statusColors: [
    { name: "Šedá", value: "#6b7280" },
    { name: "Modrá", value: "#3b82f6" },
    { name: "Indigová", value: "#6366f1" },
    { name: "Fialová", value: "#8b5cf6" },
    { name: "Jantarová", value: "#f59e0b" },
    { name: "Oranžová", value: "#f97316" },
    { name: "Červená", value: "#ef4444" },
    { name: "Zelená", value: "#22c55e" },
    { name: "Tyrkysová", value: "#14b8a6" },
  ],
  /** Expiry choices of an invite link, labelled as in the app; seven days is the default. */
  inviteExpiry: ["6 hodin", "24 hodin", "48 hodin", "7 dní", "30 dní"],
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
