import { CopyButton } from "./copy-button";
import { Fragment } from "react";
import { tidy } from "@/lib/typography";
import { DEPLOY } from "@/lib/workeee";
import { Typo } from "./typo";

/**
 * One command. Each word is an unbreakable box, so a long line wraps at its
 * spaces and never after the hyphen of a flag. A single word wider than the
 * block, such as the clone address on a narrow phone, still breaks inside.
 */
/** An address may break after a slash, never in the middle of a name. */
function breakAfterSlashes(word: string) {
  const parts = word.split("/");
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 && (
        <>
          /<wbr />
        </>
      )}
    </Fragment>
  ));
}

function CodeLine({ line }: { line: string }) {
  const words = line.split(" ");

  return (
    <span className={`code-line ${line.startsWith("#") ? "text-[#a3a9b5]" : ""}`}>
      {words.map((word, index) => (
        <Fragment key={index}>
          <span className="code-word">{breakAfterSlashes(word)}</span>
          {index < words.length - 1 && " "}
        </Fragment>
      ))}
    </span>
  );
}

/**
 * Heading and lead on the left, which stay in view while the four steps pass on
 * the right. The commands sit in dark blocks: they are the objects here.
 */
export function Deploy() {
  return (
    <section id="nasazeni" className="bg-surface py-24 lg:py-36">
      <div className="wrap grid gap-14 lg:grid-cols-12 lg:gap-x-16">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <h2 className="display-section">{DEPLOY.title}</h2>
            <p className="mt-5 max-w-[30rem] text-lg leading-relaxed text-pretty text-muted">
              {tidy(DEPLOY.lead)}
            </p>
          </div>
        </div>

        <ol className="flex flex-col gap-12 lg:col-span-7 lg:gap-14">
          {DEPLOY.steps.map((step, index) => (
            <li
              key={step.title}
              className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-x-6"
            >
              <span
                aria-hidden="true"
                className="text-4xl leading-none font-semibold tracking-[-0.03em] text-deep sm:text-5xl"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-xl leading-tight font-semibold tracking-[-0.015em] sm:text-[1.375rem]">
                  {tidy(step.title)}
                </h3>
                <p className="mt-2.5 max-w-[34rem] leading-relaxed text-pretty text-muted">
                  <Typo>{step.body}</Typo>
                </p>
              </div>
              {/* The copy button sits in the right padding of the block, never over a command. */}
              <div className="relative col-span-2 mt-5 sm:col-span-1 sm:col-start-2">
                <pre className="code rounded-control bg-ink py-4 pr-14 pl-4 text-[#e9ebf0] sm:pl-5">
                  <code>
                    {step.lines.map((line) => (
                      <CodeLine key={line} line={line} />
                    ))}
                  </code>
                </pre>
                <CopyButton lines={step.lines} label={`Kopírovat příkazy: ${step.title}`} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
