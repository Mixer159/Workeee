import { RepoButton } from "@/components/marketing/repo-button";
import { Shot } from "@/components/marketing/shot";
import { SHOTS } from "@/lib/shots";

/**
 * The hero, as a two-column statement: the sentence the page exists to say on
 * the left, the copy and the page's one button on the right, bottom-aligned.
 * The one phrase that decides whether somebody keeps reading — that the thing
 * runs on their own infrastructure — is the only text on the page set in the
 * accent color.
 *
 * The board sits underneath at the column's full width, and the strip of three
 * claims closes the section: short enough to be read on the way past, and each
 * one something the hero itself did not already say.
 *
 * Two captures, and the phone is not a nicety. The desktop board at 390 px is
 * a seventh of the scale it was taken at — four columns of unreadable text,
 * which is a worse advert for the product than no picture at all. Both are
 * `priority`, and the `sizes` are what keep that from costing anything: each
 * one is displayed at zero width on the side of `md` it is hidden on, so the
 * browser preloads the smallest candidate there instead of a picture it will
 * never paint.
 */
const CLAIMS = [
  "Open source pod licencí MIT",
  "Nasadíte během jednoho odpoledne",
  "Žádné poplatky za členy týmu",
];

export function Hero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[84rem] px-6 pt-16 lg:px-10 lg:pt-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-16">
          <h1
            data-rise
            className="max-w-[13ch] font-heading text-[clamp(2.75rem,6.8vw,5.25rem)] leading-[1.02] font-bold tracking-[-0.045em] lg:col-span-7"
          >
            Týmová nástěnka, která{" "}
            <span className="text-primary">běží u vás.</span>
          </h1>

          <div className="lg:col-span-5 lg:pb-2">
            <p
              data-rise
              style={{ "--delay": "140ms" } as React.CSSProperties}
              className="max-w-[30rem] text-[1.0625rem] leading-[1.6] tracking-[-0.008em] text-muted-foreground"
            >
              Projekty, úkoly, komentáře a přílohy na jednom místě. Nasadíte si
              ji na vlastní Convex a Vercel, takže data máte pod kontrolou.
            </p>

            <div
              data-rise
              style={{ "--delay": "280ms" } as React.CSSProperties}
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3"
            >
              <RepoButton />
              <a
                href="#nasazeni"
                className="rounded-md text-sm text-muted-foreground underline decoration-border underline-offset-[6px] transition-colors outline-none hover:text-foreground hover:decoration-primary focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                Nasazení krok za krokem
              </a>
            </div>
          </div>
        </div>

        <div
          data-rise
          style={{ "--delay": "420ms" } as React.CSSProperties}
          className="mt-14 pb-16 lg:mt-20 lg:pb-20"
        >
          <Shot
            shot={SHOTS.boardMobile}
            crop
            priority
            className="aspect-[3/4] md:hidden"
            imageClassName="object-[50%_18%]"
            sizes="(min-width: 768px) 1px, 100vw"
          />
          <Shot
            shot={SHOTS.board}
            priority
            className="hidden md:block"
            sizes="(min-width: 87rem) 79rem, (min-width: 768px) calc(100vw - 3rem), 1px"
          />
        </div>
      </div>

      {/* The strip reads on the way past: three claims, three hairline cells,
          and none of them repeats what the hero already said. */}
      <div className="border-t border-border">
        <div className="mx-auto grid max-w-[84rem] grid-cols-1 divide-y divide-border px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:px-10">
          {CLAIMS.map((claim) => (
            <p
              key={claim}
              className="py-4 text-sm text-muted-foreground sm:px-8 sm:py-5 sm:first:pl-0 sm:last:pr-0"
            >
              {claim}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
