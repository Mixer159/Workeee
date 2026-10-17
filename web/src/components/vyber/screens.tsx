import Image from "next/image";
import { PAINTING_QUALITY, PHOTOS } from "@/lib/photos";
import { tidy } from "@/lib/typography";
import { SHOTS, SURFACES, type Shot } from "@/lib/workeee";
import { Typo } from "./typo";

type Step = {
  id: string;
  title: string;
  body: string;
  shot: Shot;
  /**
   * How the capture sits in the square window: enlarged by `zoom`, with `x`
   * and `y` (shares of the capture's size) at the window's top left corner.
   * The window shows 1 / zoom of the capture's width from there.
   */
  zoom: number;
  x: number;
  y: number;
  /** The capture's own background, for a window it does not fill. */
  ground: string;
};

function surface(id: string) {
  const found = SURFACES.find((item) => item.id === id);
  if (!found) throw new Error(`Missing surface ${id}`);
  return found;
}

const drawer = surface("drawer");
const comments = surface("komentare");

/**
 * One task's way through the app, in three steps: the project's board, the
 * task opened beside it, the discussion under the task. Each crop shows the
 * part of the screen its text is about.
 */
const STEPS: Step[] = [
  {
    id: "nastenka",
    title: "Úkoly na nástěnce",
    body: "Každý projekt je nástěnka se sloupci podle stavu. Karty přetahujete mezi sloupci i uvnitř sloupce.",
    shot: SHOTS.board,
    // The To-do and V průběhu columns whole, from just right of the sidebar;
    // the strip under them is the board's own background.
    zoom: 1.9,
    x: 0.228,
    y: 0,
    ground: "#f4f7fb",
  },
  {
    id: drawer.id,
    title: "Detail vedle nástěnky",
    body: drawer.body,
    shot: drawer.shot,
    // The opened task: title, state, assignee, checklist and attachments.
    zoom: 2.2,
    x: 0.535,
    y: 0,
    ground: "#fbfcfe",
  },
  {
    id: comments.id,
    title: comments.title,
    // "@" stays with the word after it, so a line never ends on it.
    body: comments.body.replace("@ ", "@ "),
    shot: comments.shot,
    // The whole thread at full width; the window's lower strip is the
    // capture's own background.
    zoom: 1,
    x: 0,
    y: 0,
    ground: "#fbfcfe",
  },
];

/**
 * How a task moves through Workeee, as three cards in order. The middle card
 * is near-black and a little taller. The ground is the hero painting
 * itself, turned grey and multiplied by the green of its fields
 * (PHOTOS.poleMalbaZelena, baked by scripts/tint-painting.mjs): the
 * brushwork shows, and no part is lighter than that green, so the white
 * text keeps its contrast.
 */
export function Screens() {
  return (
    <section id="obrazovky" className="relative isolate overflow-x-clip bg-grass py-20 text-white [--focus:#ffffff] lg:py-28">
      <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
        <Image src={PHOTOS.poleMalbaZelena.src} alt="" fill sizes="100vw" quality={PAINTING_QUALITY} className="object-cover" />
      </div>
      <div className="wrap">
        <h2 className="display-section mx-auto max-w-[19ch] text-center">{tidy("Jak se s Workeee pracuje")}</h2>
        <p className="mx-auto mt-5 max-w-[36rem] text-center text-lg leading-relaxed text-pretty text-grass-soft">
          <Typo>
            Projekt je nástěnka s úkoly. Kliknete na úkol, otevře se jeho detail a diskuse o něm běží přímo pod ním.
          </Typo>
        </p>

        <div className="mx-auto mt-10 max-w-[64rem] lg:mt-14">
          <ol className="relative mx-3 grid gap-6 lg:mx-0 lg:grid-cols-3 lg:gap-6">
            {STEPS.map((step, index) => {
              const dark = index === 1;
              return (
                <li
                  key={step.id}
                  className={`flex flex-col overflow-hidden rounded-panel p-4 shadow-screen sm:flex-row sm:items-center lg:flex-col lg:items-stretch ${
                    dark ? "bg-ink text-white lg:-my-4" : "bg-surface text-ink"
                  }`}
                >
                  <div
                    className="relative aspect-square overflow-hidden rounded-inset ring-1 ring-black/10 sm:w-[46%] sm:shrink-0 lg:w-auto"
                    style={{ backgroundColor: step.ground }}
                  >
                    <Image
                      src={step.shot.src}
                      alt={step.shot.alt}
                      width={step.shot.width}
                      height={step.shot.height}
                      sizes={`(min-width: 1024px) ${Math.round(step.zoom * 330)}px, (min-width: 640px) ${Math.round(step.zoom * 45)}vw, ${Math.round(step.zoom * 90)}vw`}
                      className="absolute top-0 left-0 h-auto max-w-none"
                      style={{
                        width: `${step.zoom * 100}%`,
                        translate: `-${step.x * 100}% -${step.y * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex flex-1 flex-col px-2 pt-6 pb-4 sm:px-7 sm:py-4 lg:px-3 lg:pt-7 lg:pb-5">
                    <h3 className="text-[1.3125rem] leading-[1.2] font-semibold tracking-[-0.02em]">
                      {tidy(step.title)}
                    </h3>
                    <p className={`mt-3 leading-relaxed text-pretty ${dark ? "text-soft" : "text-muted"}`}>
                      <Typo>{step.body}</Typo>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
