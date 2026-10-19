import Image from "next/image";
import { PAINTING_QUALITY, PHOTOS } from "@/lib/photos";
import { tidy } from "@/lib/typography";

/**
 * The head of a sub-page: the hero's construction at a smaller scale. The
 * painting shows as a band at the top and down the sides of a white sheet with
 * rounded top corners, and fades out towards the bottom, so the sheet turns
 * into the page. Styles are `.page-head*` in vyber.css.
 */
export function PageHead({ title, lead }: { title: string; lead: string }) {
  return (
    <section id="top" className="page-head" aria-labelledby="page-title">
      <div className="page-head-paint" aria-hidden="true">
        {/* The largest element of the first screen (LCP); only bands of it show. */}
        <Image
          src={PHOTOS.poleMalba.src}
          alt=""
          fill
          sizes="(min-width: 1024px) 75vw, 100vw"
          quality={PAINTING_QUALITY}
          loading="eager"
          fetchPriority="high"
        />
      </div>
      <div className="page-head-sheet">
        <h1 id="page-title" className="page-head-title">
          {title}
        </h1>
        <p className="mx-auto mt-5 max-w-[34rem] text-lg leading-relaxed text-pretty text-muted">{tidy(lead)}</p>
      </div>
    </section>
  );
}
