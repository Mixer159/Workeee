/**
 * The changelog. Content, not data: it ships with the code, it is versioned by
 * git next to the change it describes, and the public page that renders it must
 * not open a websocket to show a list of dates.
 *
 * One array, two renderers: the "Změny" section of the landing page takes the
 * first few, `/zmeny` takes all of them grouped by month. Newest first, and the
 * order of this array is the order on screen; nothing sorts it.
 *
 * An entry is written for a person using the app, so it says what changed for
 * them. A refactor nobody can see deliberately gets nothing.
 */

export type ChangelogEntry = {
  /** `YYYY-MM-DD`. Rendered through `formatIsoDate` / `formatIsoMonth`. */
  date: string;
  title: string;
  /** The part of the app the entry is about. One is usually enough. */
  tags?: string[];
  items: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-08-13",
    title: "Šest barevných vzhledů",
    tags: ["Vzhled"],
    items: [
      "V nabídce účtu lze vybírat ze tří světlých a tří tmavých barevných vzhledů.",
      "Výchozí pracovní plocha je světle modrá; tmavé varianty mají barevný, zesvětlený základ místo téměř černé.",
      "Vybraný vzhled se uloží v prohlížeči a použije se ještě před vykreslením stránky.",
    ],
  },
  {
    date: "2026-08-13",
    title: "Panel úkolů podle vaší ruky",
    tags: ["Úkoly"],
    items: [
      "Šířku levého panelu pracovního režimu změníte tažením za jeho pravý okraj nebo šipkami na klávesnici; aplikace si ji pamatuje. Dvojklik na okraj vrátí výchozí šířku.",
    ],
  },
  {
    date: "2026-08-13",
    title: "Úkoly napříč projekty na jednom místě",
    tags: ["Úkoly"],
    items: [
      "Původní přehled projektů zůstává výchozí. Z levého panelu lze nově zapnout samostatný pracovní režim.",
      "V pracovním režimu zabírají celý levý panel úkoly ze všech dostupných projektů a organizací, seřazené podle poslední změny nebo komentáře.",
      "Úkol se otevře rovnou uprostřed včetně popisu, příloh a komentářů; seznam lze prohledat nebo omezit jen na vaše úkoly.",
      "Nový úkol lze vytvořit rovnou z pracovního režimu: kliknutím v panelu nebo přes ⌘K, výběrem projektu a napsáním názvu.",
    ],
  },
  {
    date: "2026-08-11",
    title: "Bezpečnější nahrávání souborů",
    tags: ["Soubory"],
    items: [
      "Aplikace odmítne aktivní XML dokumenty stejně jako HTML a SVG.",
      "Nedokončené nahrávání už po sobě nenechá soubor v úložišti navždy.",
    ],
  },
  {
    date: "2026-08-10",
    title: "Silnější úvod veřejné stránky",
    tags: ["Web"],
    items: [
      "Nástěnka teď prochází nápisem WORKEEE hlouběji, takže úvod je jedna složená scéna a ne obrázek pod nadpisem.",
      "Nápis vyplní šířku na každé obrazovce. Na širokých monitorech dřív končil kus před pravým okrajem.",
      "Na telefonu úvod ukazuje aplikaci tak, jak vypadá na telefonu. Zmenšená nástěnka z počítače tam nebyla k přečtení.",
      "Úvod říká navíc to podstatné: běží u vás a za lidi v týmu nikomu neplatíte.",
    ],
  },
  {
    date: "2026-08-10",
    title: "Nepřečtené na jednom pohledu",
    tags: ["Upozornění"],
    items: [
      "Karta úkolu ukazuje počet nepřečtených komentářů a úkol, který jste ještě neotevřeli, nese tečku.",
      "Projekty v levém panelu i na přehledu říkají, v kolika úkolech je něco nového.",
      "V panelu přibyla stránka Upozornění: nové úkoly, přiřazení, zmínky a komentáře na jednom místě, s počtem nepřečtených na odkazu.",
      "Otevřením úkolu se všechno kolem něj označí za přečtené. Zbytek zvládne tlačítko „Označit vše za přečtené“.",
    ],
  },
  {
    date: "2026-08-10",
    title: "Nový vzhled",
    tags: ["Vzhled"],
    items: [
      "Aplikace i veřejná stránka teď vypadají jako jedna věc: grafitové pozadí, jedna limetková barva a písmo Switzer.",
      "Nová značka. Tři sloupce a karta nad posledním z nich, místo písmene W v dlaždici.",
      "Úvodní stránka ukazuje snímky z aplikace místo popisu, co v ní asi uvidíte.",
      "Registrace vás pustí rovnou do aplikace. Občas se vracela zpátky na přihlášení.",
      "Nástěnka na pravém kraji naznačí, že za ním pokračuje další sloupec.",
    ],
  },
  {
    date: "2026-08-10",
    title: "Odolnější popisy a komentáře",
    tags: ["Úkoly"],
    items: [
      "Poškozený obsah popisu už neshodí panel úkolu a další poškozený dokument nejde uložit.",
      "Jeden úkol může mít nejvýš 200 komentářů, aby zůstal rychlý i při mazání.",
    ],
  },
  {
    date: "2026-08-10",
    title: "Veřejná stránka a přehled změn",
    tags: ["Web"],
    items: [
      "Workeee má veřejnou stránku na /o-aplikaci: co umí, jak si ho nasadit na vlastní Convex a Vercel a odkaz na repozitář.",
      "Hlavní adresa pozná přihlášení: přihlášeným otevře aplikaci, ostatním veřejnou stránku. Existující odkazy a záložky fungují beze změny.",
      "Přibyla stránka Změny, na které je tenhle seznam celý.",
      "Repozitář má licenci MIT.",
    ],
  },
  {
    date: "2026-08-10",
    title: "Panel úkolu se zavře kliknutím vedle něj",
    tags: ["Úkoly"],
    items: [
      "Kliknutí kamkoli mimo panel ho zavře, stejně jako křížek a Esc.",
      "Kliknutí na jinou kartu panel přepne na ni, místo aby ho zavřelo a hned zase otevřelo.",
    ],
  },
  {
    date: "2026-08-07",
    title: "Upozornění na komentáře",
    tags: ["Upozornění"],
    items: [
      "Komentář dá vědět těm, koho zmiňuje, a řešiteli úkolu. Nikomu dalšímu, protože komentářů je o řád víc než úkolů.",
      "Deset odpovědí pod jedním úkolem je v e-mailu jeden řádek s počtem.",
      "Komentář je v e-mailu citovaný, takže je z něj poznat, o co jde, ještě před otevřením úkolu.",
    ],
  },
  {
    date: "2026-08-07",
    title: "Dávkovaná e-mailová upozornění",
    tags: ["Upozornění"],
    items: [
      "Nový úkol v projektu a úkol přiřazený vám chodí e-mailem.",
      "Osm úkolů napsaných za sebou přijde jako jedna zpráva s počtem v předmětu, ne jako osm zpráv.",
      "V nastavení je na to jeden přepínač a ve výchozím stavu je zapnutý.",
    ],
  },
  {
    date: "2026-08-02",
    title: "Ikona projektu z SVG",
    tags: ["Projekty"],
    items: [
      "Projekt může mít ikonu ve formátu SVG. Značka se kontroluje proti seznamu povolených prvků a ukládá se k projektu, ne do úložiště souborů.",
    ],
  },
  {
    date: "2026-08-02",
    title: "Ikona z faviconu a nástěnka na užším displeji",
    tags: ["Projekty", "Nástěnka"],
    items: [
      "Jako ikonu projektu jde nahrát i favicon (.ico), vedle PNG, JPG, WEBP a GIF.",
      "Do stran se posouvá jen nástěnka, ne celá stránka. Výchozí tři sloupce se vejdou i na užší notebook.",
    ],
  },
  {
    date: "2026-08-02",
    title: "Vlastní značka a náhledy odkazů",
    tags: ["Web"],
    items: [
      "Aplikace má vlastní ikonu v záložce prohlížeče, na ploše telefonu i v seznamu záložek.",
      "Odkaz vložený do chatu se rozbalí do náhledu. Pozvánka má svůj vlastní.",
    ],
  },
  {
    date: "2026-07-31",
    title: "Popis úkolu vypadá jako v Notionu",
    tags: ["Úkoly"],
    items: [
      "Text popisu začíná tam, kde název úkolu, a úchyty bloků sedí v okraji panelu místo mimo něj.",
      "Po lomítku se otevře nabídka bloků a nadpis se od té chvíle opravdu vykreslí jako nadpis.",
    ],
  },
  {
    date: "2026-07-30",
    title: "První verze",
    tags: ["Start"],
    items: [
      "Organizace, projekty a úkoly. Registrace e-mailem a heslem, bez čekání na schválení.",
      "Nástěnka se stavy, které si projekt určuje sám. Karty se přetahují mezi sloupci i uvnitř sloupce.",
      "Detail úkolu s blokovým popisem, přílohami a komentáři se zmínkami.",
      "Role a dvě úrovně přístupu: celá organizace, nebo jen vybrané projekty.",
      "Jednorázové pozvánky odkazem, pro organizaci nebo pro jeden projekt.",
      "Mazání organizace potvrzené jejím názvem, po dávkách a až do konce.",
      "Denní úklid souborů, na které už nic neodkazuje.",
    ],
  },
];

/** How many entries the landing page shows before the link to the full list. */
export const CHANGELOG_PREVIEW_COUNT = 4;

/**
 * The entries in month buckets, in the order the array already has them. Used
 * only by `/zmeny`; the landing page renders a flat slice.
 */
export function groupChangelogByMonth(
  entries: ChangelogEntry[],
): { month: string; entries: ChangelogEntry[] }[] {
  const groups: { month: string; entries: ChangelogEntry[] }[] = [];
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === month) {
      last.entries.push(entry);
    } else {
      groups.push({ month, entries: [entry] });
    }
  }
  return groups;
}
