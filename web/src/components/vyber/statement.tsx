import { tidy } from "@/lib/typography";
import { HERO } from "@/lib/workeee";

/**
 * HERO.leadLong cut into phrases that alternate between ink and the faded grey.
 * The phrases are checked against the shared text, so a change there fails the
 * build instead of drifting.
 */
const PHRASES = [
  { text: "Projekty, úkoly, komentáře a přílohy", faded: false },
  { text: "na jednom místě.", faded: true },
  { text: "Nasadíte si ji na vlastní Convex a Vercel,", faded: false },
  { text: "takže data máte pod kontrolou.", faded: true },
];

if (PHRASES.map((phrase) => phrase.text).join(" ") !== HERO.leadLong) {
  throw new Error("The statement phrases no longer add up to HERO.leadLong.");
}

export function Statement() {
  return (
    <section className="bg-surface">
      <div className="wrap pt-12 pb-24 lg:pt-16 lg:pb-36">
      <p className="statement mx-auto max-w-[60rem] text-center text-balance">
        {PHRASES.map((phrase, index) => (
          <span key={phrase.text} className={phrase.faded ? "text-faded" : "text-ink"}>
            {index > 0 && " "}
            {tidy(phrase.text)}
          </span>
        ))}
      </p>
      </div>
    </section>
  );
}
