import { Shot } from "@/components/marketing/shot";
import { SHOTS } from "@/lib/shots";
import type { Shot as ShotData } from "@/lib/shots";
import { cn } from "@/lib/utils";

/**
 * The product as a horizontal gallery: the four surfaces a person works in all
 * day, side by side, scrollable by a flick. Every picture is a capture of the
 * running app — the section's one line of copy says so, because it is the
 * reason the page has no mock-ups and no invented chrome.
 *
 * The wide captures keep their own 16:10; the two portrait ones are cropped
 * from the top to roughly the same height, because the control each caption is
 * about sits at the top of its screen. The strip's right edge softens while
 * there is more to scroll (`workeee-scroll-fade`, driven by the scroll
 * position itself, so no listener and nothing to clean up).
 */
const GALLERY: {
  shot: ShotData;
  title: string;
  caption: string;
  className: string;
  sizes: string;
  crop?: boolean;
}[] = [
  {
    shot: SHOTS.drawer,
    title: "Úkol vedle nástěnky",
    caption:
      "Kliknutí na kartu otevře detail vpravo a nástěnka pod ním dál funguje. Otevřený úkol je v adrese, pošlete ho odkazem.",
    className: "w-[80vw] sm:w-[34rem] lg:w-[42rem]",
    sizes: "(min-width: 1024px) 42rem, (min-width: 640px) 34rem, 80vw",
  },
  {
    shot: SHOTS.editor,
    title: "Popis jako dokument",
    caption:
      "Blokový editor s nadpisy, seznamy a obrázky. Lomítko otevře nabídku bloků a ukládá se sám.",
    className: "w-[70vw] sm:w-[20rem]",
    sizes: "(min-width: 640px) 20rem, 70vw",
    crop: true,
  },
  {
    shot: SHOTS.prace,
    title: "Pracovní režim",
    caption:
      "Nejnovější úkoly ze všech projektů a organizací v jednom panelu. Otevřený úkol upravujete vedle něj.",
    className: "w-[80vw] sm:w-[34rem] lg:w-[42rem]",
    sizes: "(min-width: 1024px) 42rem, (min-width: 640px) 34rem, 80vw",
  },
  {
    shot: SHOTS.comments,
    title: "Komentáře se zmínkami",
    caption:
      "Diskuse přímo u úkolu, s přílohami. Zmínka @ jménem pošle dotyčnému upozornění.",
    className: "w-[70vw] sm:w-[20rem]",
    sizes: "(min-width: 640px) 20rem, 70vw",
    crop: true,
  },
];

export function Product() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[84rem] px-6 py-24 lg:px-10 lg:py-36">
        <h2
          data-enter
          className="max-w-[26ch] font-heading text-[clamp(1.75rem,4.2vw,3rem)] leading-[1.05] font-bold tracking-[-0.035em]"
        >
          Podívejte se dovnitř.
        </h2>
        <p
          data-enter
          className="mt-5 max-w-[34rem] text-[0.9375rem] leading-relaxed text-muted-foreground"
        >
          Žádné makety. Každý obrázek na této stránce je snímek běžící aplikace.
        </p>

        <div
          data-enter
          className="workeee-scroll-fade -mx-6 mt-14 snap-x snap-proximity overflow-x-auto px-6 pb-2 lg:-mx-10 lg:px-10"
        >
          <div className="flex w-max items-start gap-6 lg:gap-8">
            {GALLERY.map((item) => (
              <figure key={item.title} className={cn("snap-start", item.className)}>
                <Shot
                  shot={item.shot}
                  crop={item.crop}
                  className={item.crop ? "aspect-[4/5]" : undefined}
                  sizes={item.sizes}
                />
                <figcaption className="mt-5">
                  <h3 className="text-sm font-semibold tracking-[-0.01em]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.caption}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
