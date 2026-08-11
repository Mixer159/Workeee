import { Shot } from "@/components/marketing/shot";
import { SHOTS } from "@/lib/shots";

/**
 * The one idea the product is built around, shown at the size it deserves: the
 * task opens beside the board, not instead of it.
 *
 * Nothing is laid over this capture and nothing sits beside it. Every other
 * screenshot on the page is a supporting detail in a grid cell; this is the
 * product in one frame, and putting a second picture on top of it would be
 * spending the section's one idea on decoration.
 */
export function Product() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[84rem] px-6 py-24 lg:px-10 lg:py-36">
        <div data-enter className="max-w-[36rem]">
          <h2 className="font-heading text-[clamp(1.75rem,4.2vw,3rem)] leading-[1.05] font-bold tracking-[-0.035em]">
            Úkol nikdy neopustí nástěnku.
          </h2>
          <p className="mt-5 text-[0.9375rem] leading-relaxed text-muted-foreground">
            Kliknutí na kartu otevře panel vpravo. Nástěnka pod ním dál funguje,
            karty jde přetahovat a kliknutí na jinou kartu panel jen přepne.
            Otevřený úkol je v adrese, takže se dá poslat odkazem.
          </p>
        </div>

        <div data-enter className="mt-16">
          <Shot shot={SHOTS.drawer} sizes="(min-width: 1024px) 84rem, 100vw" />
        </div>
      </div>
    </section>
  );
}
