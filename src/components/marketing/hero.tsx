import Image from "next/image";
import { RepoButton } from "@/components/marketing/repo-button";
import { Shot } from "@/components/marketing/shot";
import { SHOTS } from "@/lib/shots";

/**
 * The hero, and the one composition on the page that is allowed to be loud.
 *
 * The word and the product are a single image, not two stacked blocks. Four
 * layers do it, and they are real layers rather than one pre-composed picture:
 *
 *   z-40  a single task card, in front of everything
 *   z-30  the letters `EE`, and the copy column
 *   z-20  the board, crossing the lower third of the letterforms
 *   z-10  the letters `WORKE`
 *
 * The word is split into two spans so the second one can sit at z-30 and come
 * back out *in front* of the board. That split is the whole trick: without it
 * the screenshot is merely on top of the type, and the eye reads two things.
 * With it, the board passes through the word. The spans are adjacent with no
 * space, so it is still one word to a screen reader and to anything that copies
 * the text.
 *
 * **Everything here is sized in `cqi`**, and the wrapper is a container for that
 * reason alone. The word used to be `clamp(3rem, 17.4vw, 15rem)`, which is two
 * mistakes in one value: below the cap it was measured against the *viewport*
 * while the thing it had to fill was the content column, and above the cap —
 * from about 1400 px, which is most desktops — it stopped growing while the
 * column did not, so the word ended a fist short of the right edge and the
 * composition looked laid out for a narrower screen. One `cqi` is one percent
 * of that column, so `22cqi` fills it at every width, and the overlap and the
 * card, given in the same unit, hold their proportions with it.
 *
 * Legibility floor: the board's top edge leaves about two thirds of every
 * letterform showing. That is the *point* of the number — at the previous four
 * fifths the board grazed the baseline and read as a picture parked under a
 * headline. Nothing here is fixed with a text shadow.
 *
 * Below `md` the sandwich is dropped entirely and the section becomes a plain
 * stack: word, sentence, buttons, board. On a phone there is no room for a
 * composition, and floating fragments at that width read as a bug.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Four plates of light, all pointer-transparent, none of them animated.
          They are the only depth in the section that is not a real layer, and
          they are kept low enough to read as a lit surface rather than as a
          gradient: the texture, one cold sheen behind the word, one lime bloom
          exactly where the board cuts into the letterforms, and a floor that
          darkens the bottom edge so the composition stands on something. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/marketing/texture.jpg')] bg-cover bg-center opacity-[0.22] mix-blend-screen"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(78%_58%_at_58%_-16%,hsl(210_40%_70%/0.07),transparent_62%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(42%_44%_at_38%_34%,hsl(var(--primary)/0.13),transparent_66%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-[linear-gradient(to_top,hsl(220_40%_2%/0.55),transparent)]"
      />

      <div className="@container mx-auto max-w-[84rem] px-6 pt-12 pb-20 lg:px-10 lg:pt-16 lg:pb-24">
        {/* One `relative` frame around the word and the row below it, so the
            card in flight is positioned against the *word* and not against the
            section's padding box — which grows at `lg` and would slide the card
            out from under the letterforms it is there to cross. */}
        <div className="relative">
          {/* The load-in sits on the two spans and not on the `h1`, and that is
              not a detail: an `animation` that touches `transform` makes its
              element a stacking context, so animating the heading trapped the
              `EE` span's `z-30` inside it and the board painted over all three
              E's. Animated separately, the spans stay siblings of the board in
              one stacking context and the sandwich holds. They still rise as
              one word, because they share a keyframe and a delay. */}
          <h1 className="workeee-display flex text-[22cqi]">
            <span
              data-rise
              style={{ "--rise": "0.12em" } as React.CSSProperties}
              className="relative z-10"
            >
              WORKE
            </span>
            <span
              data-rise
              style={{ "--rise": "0.12em" } as React.CSSProperties}
              className="relative z-30"
            >
              EE
            </span>
          </h1>

          <div className="grid grid-cols-12 gap-x-6">
            {/* Four columns from `xl`, not five. The column was wider than what
                stood in it: two short lines and a button left a hole underneath
                that read as a missing element rather than as air. A narrower
                measure fills, and it hands the width back to the board. It
                stays at five below `xl`, where four columns would be narrower
                than the button plus its link and the two would stack. */}
            <div
              data-rise
              style={{ "--delay": "300ms" } as React.CSSProperties}
              className="relative z-30 col-span-12 mt-9 flex flex-col items-start md:col-span-5 md:mt-0 md:self-center xl:col-span-4"
            >
              {/* The same short accent stroke `og.tsx` draws above every link
                  preview, which is itself the rule the rail draws beside the
                  project you have open. It is the one place the accent shows up
                  in the composition that is not the button. */}
              <span
                data-sweep
                style={{ "--delay": "760ms" } as React.CSSProperties}
                className="block h-1 w-16 rounded-full bg-primary"
              />

              <p className="mt-7 max-w-[26rem] text-[1.0625rem] leading-[1.55] tracking-[-0.012em]">
                Projekty, nástěnka a úkoly pro tým.
              </p>
              <p className="mt-3 max-w-[26rem] text-[0.9375rem] leading-relaxed text-muted-foreground">
                Open source. Běží na vašem Convexu a vašem Vercelu, takže data
                zůstanou u vás a za lidi v týmu nikomu neplatíte.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <RepoButton />
                <a
                  href="#nasazeni"
                  className="rounded-md text-sm text-muted-foreground underline decoration-border underline-offset-[6px] transition-colors outline-none hover:text-foreground hover:decoration-primary focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  Jak si to nasadit
                </a>
              </div>
            </div>

            {/* The board. `-mt-[6cqi]` is what lifts it into the word, and it is
                in the same unit as the font size, so the overlap is a fixed
                fraction of a letterform rather than something eyeballed at one
                width. It is measured against the *line box*, not the baseline:
                at `leading-[0.82]` the glyphs stop about `0.05em` above the
                box's bottom edge, which is why a value that looks right on
                paper leaves a gap on screen.

                It is also cropped, and that is the other half of why the hero
                used to sag. The capture is a whole 1440 × 900 viewport and its
                bottom quarter is empty board, so at the file's own aspect the
                picture spent a fifth of the section's height on nothing. Cut to
                2.16:1 it ends just under the last card, which reads as a board
                that carries on past the fold — which it does. */}
            <div
              data-settle
              style={{ "--delay": "180ms" } as React.CSSProperties}
              className="relative z-20 col-span-12 mt-10 md:col-span-7 md:col-start-6 md:-mt-[6cqi] xl:col-span-8 xl:col-start-5"
            >
              <div
                data-drift
                style={{ "--drift": "-1.75rem" } as React.CSSProperties}
              >
                {/* Two captures, and the phone is not a nicety. The desktop
                    board at 342 px is a seventh of the scale it was taken at —
                    four columns of unreadable grey, which is a worse advert for
                    the product than no picture at all. The app's own phone
                    layout is legible at that width, and it happens to say
                    something true that nothing else on the page says.

                    Both are `priority`, and the `sizes` are what keep that from
                    costing anything: each one is displayed at zero width on the
                    side of `md` it is hidden on, so it says so, and the browser
                    preloads the smallest candidate there instead of a picture
                    it will never paint.

                    The phone one is cropped from just under the app's own top
                    bar rather than from the top: that bar carries the wordmark
                    and the page's header carries it too, ninety pixels above,
                    and two of them on one screen read as a mistake rather than
                    as a screenshot. */}
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
                  crop
                  priority
                  className="hidden aspect-[2.16/1] shadow-[0_44px_90px_-34px_hsl(220_40%_2%/0.95)] md:block"
                  sizes="(min-width: 768px) 66vw, 1px"
                />
              </div>
            </div>
          </div>

          {/* The card in flight — the mark's fourth shape at page scale, and the
              only thing on the page in front of both the type and the product.
              It is centred on the board's top-left corner on purpose: parked
              out on its own over the `W`, as it was, it read as a stray tooltip
              instead of as a card lifted off the board it belongs to, and it
              crossed the letterforms at their waist, which is the one height
              that costs legibility. Here it pokes barely above the line the
              board already occludes.

              It is cropped to the card's own bounds, so the pixels carry its
              border and its corner and it needs no frame: another `Shot` would
              draw a second border a pixel outside the first. `top` is in `cqi`
              because it is measured against the word; `left` and `width` are
              percentages of the same column, which is the same measurement
              written the shorter way. Hidden below `md` with the rest of the
              sandwich. */}
          <Image
            data-rise
            style={{ "--delay": "620ms" } as React.CSSProperties}
            src={SHOTS.card.src}
            alt={SHOTS.card.alt}
            width={SHOTS.card.width}
            height={SHOTS.card.height}
            sizes="24vw"
            className="pointer-events-none absolute top-[10.1cqi] z-40 hidden h-auto w-[23.5%] rounded-lg shadow-[0_30px_54px_-18px_hsl(220_40%_2%/0.95)] md:left-[33%] md:block xl:left-[24.5%]"
          />
        </div>
      </div>
    </section>
  );
}
