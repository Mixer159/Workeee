import { Shot } from "@/components/marketing/shot";
import { SHOTS } from "@/lib/shots";
import type { Shot as ShotData } from "@/lib/shots";
import { cn } from "@/lib/utils";

/**
 * What the thing actually is, in facts. No adjectives, no benefits, no verbs
 * borrowed from a pitch deck: six statements a developer can check against the
 * repository in about a minute, and three pictures of the screens the
 * statements are hardest to believe from words alone.
 *
 * One grid, nine cells, none of them empty, and the hairlines are drawn by the
 * cells themselves. The rules come off the cell's **index**, not off
 * `nth-child` variants: `border-r` and `border-r-0` set the same property, so
 * stacking them behind two breakpoint variants is a specificity argument
 * waiting to be lost. An index knows which column a cell is in, at every
 * breakpoint, for the price of one `%`.
 *
 * The grid is pulled out past its own text by exactly the padding the cells put
 * back, so the rules run slightly wider than the words they separate and the
 * first cell still lines up under the heading.
 */
type Cell =
  | { kind: "fact"; title: string; body: string }
  | { kind: "shot"; shot: ShotData; caption: string };

const CELLS: Cell[] = [
  {
    kind: "fact",
    title: "Organizace, projekty, úkoly",
    body: "Tři úrovně a nic mezi nimi. Člověk patří do organizace, projekt do organizace, úkol do projektu.",
  },
  {
    kind: "fact",
    title: "Nástěnka s vlastními stavy",
    body: "Tři sloupce dostane každý projekt při založení. Další si pojmenujete a obarvíte sami, nejvýš dvanáct.",
  },
  {
    kind: "fact",
    title: "Role a viditelnost",
    body: "Vlastník, správce, člen. K tomu buď celá organizace, nebo jen projekty, do kterých vás někdo pozval.",
  },
  {
    kind: "fact",
    title: "Pozvánky odkazem",
    body: "Jeden odkaz na jedno použití, s platností od šesti hodin do třiceti dnů. Do organizace, nebo do jednoho projektu.",
  },
  {
    kind: "fact",
    title: "Přílohy u úkolu i v komentáři",
    body: "Do deseti megabajtů, třicet souborů na úkol. Co na nic neodkazuje, denní úklid sám smaže.",
  },
  {
    kind: "fact",
    title: "E-maily po dávkách",
    body: "Osm úkolů napsaných za sebou je jeden e-mail s počtem v předmětu, ne osm zpráv.",
  },
  {
    kind: "shot",
    shot: SHOTS.editor,
    caption:
      "Lomítko otevře nabídku bloků. Popis se ukládá sám, vteřinu po tom, co dopíšete.",
  },
  {
    kind: "shot",
    shot: SHOTS.comments,
    caption:
      "Zmínka je uložená jako konkrétní člověk, ne jako text. Podle ní se pozná, komu má přijít e-mail.",
  },
  {
    kind: "shot",
    shot: SHOTS.settings,
    caption:
      "Ikona projektu jako obrázek, SVG nebo emoji. Pozvánky do projektu na stejném místě.",
  },
];

export function Facts() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[84rem] px-6 py-24 lg:px-10 lg:py-36">
        <h2
          data-enter
          className="max-w-[26ch] font-heading text-[clamp(1.75rem,4.2vw,3rem)] leading-[1.05] font-bold tracking-[-0.035em]"
        >
          Co Workeee je, bez opisování.
        </h2>

        <div
          data-enter-stagger
          className="mt-16 -mx-5 grid grid-cols-1 border-t border-border sm:grid-cols-2 lg:grid-cols-3"
        >
          {CELLS.map((cell, index) => (
            <div
              key={cell.kind === "fact" ? cell.title : cell.shot.src}
              className={cn(
                "border-b border-border px-5 py-8",
                index % 2 === 0 && "sm:border-r lg:border-r-0",
                index % 3 !== 2 && "lg:border-r",
              )}
            >
              {cell.kind === "fact" ? (
                <>
                  <h3 className="text-sm font-semibold tracking-[-0.01em]">
                    {cell.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {cell.body}
                  </p>
                </>
              ) : (
                <figure>
                  <Shot
                    shot={cell.shot}
                    crop
                    className="aspect-[4/3]"
                    sizes="(min-width: 1024px) 27vw, (min-width: 640px) 44vw, 92vw"
                  />
                  <figcaption className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {cell.caption}
                  </figcaption>
                </figure>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
