import Image from "next/image";
import { Fragment } from "react";
import { ExternalIcon, GitHubIcon } from "@/components/shared/icons";
import { PAINTING_QUALITY, PHOTOS } from "@/lib/photos";
import { tidy } from "@/lib/typography";
import { ACTIONS, LINKS, OPEN_SOURCE } from "@/lib/workeee";
import { externalProps, TextLink } from "./button-link";

/**
 * The source code: the statement and one large dark button with the address of
 * the repository, with the links to the issues and the licence under it. They
 * sit on a white sheet that lies on a band of painting, the hero's
 * construction once more.
 */
export function SourceCode() {
  return (
    <section id="zdrojovy-kod" className="band">
      {/* Slightly enlarged: the reproduction shows the unpainted edge of the canvas along its top. */}
      <Image
        src={PHOTOS.planMalba.src}
        alt=""
        fill
        sizes="100vw"
        quality={PAINTING_QUALITY}
        className="-z-10 scale-[1.06] object-cover"
      />
      <div className="wrap">
      <div className="grid gap-12 rounded-panel bg-surface p-7 sm:p-10 lg:grid-cols-12 lg:items-center lg:gap-x-16 lg:p-16">
        <div className="lg:col-span-6">
          <h2 className="display-section">
            Zdrojový kód máte celý
          </h2>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-pretty text-muted">
            {tidy(OPEN_SOURCE.body)}
          </p>
        </div>

        <div className="lg:col-span-6">
          <a
            href={LINKS.repo}
            {...externalProps(LINKS.repo)}
            className="group flex min-h-64 flex-col justify-between gap-12 rounded-control bg-ink p-7 text-white transition-[background-color] duration-200 ease-out hover:bg-[#25262b] sm:min-h-72 sm:p-9"
          >
            <span className="flex items-start justify-between">
              <GitHubIcon className="size-11" />
              <ExternalIcon className="size-7 transition-[translate] duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
            <span>
              <span className="block text-3xl leading-tight font-semibold tracking-[-0.025em] sm:text-4xl">
                {ACTIONS.repo}
              </span>
              <span className="mt-3 block font-mono text-[0.9375rem] font-normal text-soft">
                {LINKS.repoLabel.split("/").map((part, index, parts) => (
                  <Fragment key={part}>
                    {part}
                    {index < parts.length - 1 && (
                      <>
                        /<wbr />
                      </>
                    )}
                  </Fragment>
                ))}
              </span>
            </span>
          </a>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            <TextLink href={LINKS.issues}>
              {ACTIONS.issues}
              <ExternalIcon className="size-4" />
            </TextLink>
            <TextLink href={LINKS.license}>
              {ACTIONS.license}
              <ExternalIcon className="size-4" />
            </TextLink>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}
