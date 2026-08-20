/**
 * What the thing does, as a numbered index. Six statements a person can check
 * against the repository in about a minute — no adjectives, no verbs borrowed
 * from a pitch deck.
 *
 * Two columns of hairline rows, and the number is the only ornament: the same
 * face and size as the title, set in the accent color. It is not set in
 * monospace on purpose — monospace on this page names things a machine reads
 * back, and a list position is not one of them.
 */
const FEATURES = [
  {
    title: "Nástěnka s vlastními stavy",
    body: "Každý projekt začne se třemi sloupci. Další si pojmenujete a obarvíte, nejvýš jich je dvanáct.",
  },
  {
    title: "Role a viditelnost",
    body: "Vlastník, správce a člen. Člen vidí celou organizaci, nebo jen projekty, do kterých ho někdo pozval.",
  },
  {
    title: "Pozvánky odkazem",
    body: "Odkaz na jedno použití, platný šest hodin až třicet dnů. Do celé organizace, nebo do jednoho projektu.",
  },
  {
    title: "Přílohy a komentáře",
    body: "Soubory do deseti megabajtů u úkolu i v komentáři. Diskuse se neztrácí v e-mailech.",
  },
  {
    title: "Upozornění po dávkách",
    body: "Přiřazení, zmínka a komentář chodí e-mailem po dávkách: osm změn za sebou je jedna zpráva s počtem v předmětu. V aplikaci je kanál s nepřečtenými nahoře.",
  },
  {
    title: "Šest vzhledů",
    body: "Tři světlé a tři tmavé palety celé aplikace. Výběr se pamatuje v prohlížeči.",
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
          Co je uvnitř
        </h2>

        <div
          data-enter-stagger
          className="mt-14 grid border-t border-border sm:grid-cols-2 sm:gap-x-16"
        >
          {FEATURES.map((feature, index) => (
            <div
              key={feature.title}
              className="flex gap-6 border-b border-border py-7"
            >
              <span
                aria-hidden
                className="pt-px text-sm font-semibold text-primary tabular-nums"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-sm font-semibold tracking-[-0.01em]">
                  {feature.title}
                </h3>
                <p className="mt-2 max-w-[30rem] text-sm leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
