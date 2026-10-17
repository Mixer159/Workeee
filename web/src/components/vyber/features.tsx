import Image from "next/image";
import { PAINTING_QUALITY, PHOTOS, type Photo } from "@/lib/photos";
import { tidy } from "@/lib/typography";
import { FEATURES, FEATURES_INTRO, type Feature } from "@/lib/workeee";
import { Typo } from "./typo";

type Tile = {
  /** Columns of the twelve-column grid the tile takes from `lg` up. */
  span: string;
  /** Panel height from `lg` up; the first row is taller than the second. */
  height: string;
  /** Rendered panel width at the widest layout, for the `sizes` hints. */
  width: number;
  /** Shape of the window the capture is shown through. */
  ratio: number;
  /**
   * Width of the capture as a multiple of the window. At 1 the whole width
   * shows and only the bottom is cut; above 1 the capture is read at a larger
   * scale and cut on the right as well.
   */
  zoom: number;
  /**
   * The part of the painting behind it: the painting is enlarged by `zoom`,
   * and `x` and `y` (0 to 1) say which part lines up with the panel's corner.
   */
  paint: { zoom: number; x: number; y: number };
};

/**
 * Two rows of three, with widths of 5, 4 and 3 columns in the first row and
 * 3, 4 and 5 in the second, so no two tiles are the same size and the inner
 * edges of the rows do not line up. Each capture gets the width its content
 * needs: boards, lists and tables are wide, the theme picker is small.
 * The order here is the order on screen.
 */
const TILES: [id: string, tile: Tile][] = [
  [
    "stavy",
    {
      span: "lg:col-span-5",
      height: "lg:h-[16.5rem]",
      width: 503,
      ratio: 2.4,
      zoom: 1,
      paint: { zoom: 2.1, x: 0.04, y: 0.1 },
    },
  ],
  [
    "role",
    {
      span: "lg:col-span-4",
      height: "lg:h-[16.5rem]",
      width: 397,
      ratio: 2.05,
      zoom: 1,
      paint: { zoom: 2.4, x: 0.82, y: 0.08 },
    },
  ],
  [
    "vzhledy",
    {
      span: "lg:col-span-3",
      height: "lg:h-[16.5rem]",
      width: 292,
      ratio: 701 / 705,
      zoom: 1,
      paint: { zoom: 2.3, x: 0.35, y: 0.5 },
    },
  ],
  [
    "upozorneni",
    {
      span: "lg:col-span-3",
      height: "lg:h-[14.5rem]",
      width: 292,
      ratio: 1.75,
      zoom: 1.75,
      paint: { zoom: 2.6, x: 0.95, y: 0.62 },
    },
  ],
  [
    "prilohy",
    {
      span: "lg:col-span-4",
      height: "lg:h-[14.5rem]",
      width: 397,
      ratio: 2,
      zoom: 1,
      paint: { zoom: 2.0, x: 0.06, y: 0.95 },
    },
  ],
  [
    "pozvanky",
    {
      span: "lg:col-span-5",
      height: "lg:h-[14.5rem]",
      width: 503,
      ratio: 1456 / 698,
      zoom: 1,
      paint: { zoom: 2.2, x: 0.5, y: 0.9 },
    },
  ],
];

/**
 * The frame is as wide as the panel allows, or as wide as the panel's height
 * allows for the window's shape, whichever is smaller. Container units make
 * that hold for every panel size without a breakpoint per tile.
 */
const FRAME_WIDTH = (ratio: number) => `min(88cqw, calc(76cqh * ${ratio}))`;

/**
 * One size hint for the painting of every tile: the largest any tile needs
 * (a 503 px tile at 2.2 x on a desktop, half the screen at 2.6 x on a
 * tablet), and on a phone 1.5 x of the screen, because only a rim of it shows
 * around the capture. One hint means each painting downloads once for all
 * the tiles that show it, instead of once per tile size.
 */
const PAINTING_SIZES = "(min-width: 1024px) 1110px, (min-width: 768px) 130vw, 150vw";

function FeatureTile({ feature, tile, painting }: { feature: Feature; tile: Tile; painting: Photo }) {
  const captureWidth = Math.round(tile.width * 0.88 * tile.zoom);

  return (
    <article>
      <div
        className={`relative isolate h-52 overflow-hidden rounded-panel bg-deep md:h-56 ${tile.height}`}
        style={{ containerType: "size" }}
      >
        {/* The painting, enlarged and shifted so each panel shows another part of it. */}
        <div
          aria-hidden="true"
          className="absolute -z-10"
          style={{
            width: `${tile.paint.zoom * 100}%`,
            height: `${tile.paint.zoom * 100}%`,
            left: `${-(tile.paint.zoom - 1) * tile.paint.x * 100}%`,
            top: `${-(tile.paint.zoom - 1) * tile.paint.y * 100}%`,
          }}
        >
          <Image src={painting.src} alt="" fill sizes={PAINTING_SIZES} quality={PAINTING_QUALITY} className="object-cover" />
        </div>

        {/* White frame, thin edge and shadow: the capture starts and ends here, inside the panel. */}
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-control bg-white p-1.5 shadow-frame" style={{ width: FRAME_WIDTH(tile.ratio) }}>
            <div className="relative overflow-hidden rounded-inset" style={{ aspectRatio: tile.ratio }}>
              <Image
                src={feature.shot.src}
                alt={feature.shot.alt}
                width={feature.shot.width}
                height={feature.shot.height}
                sizes={`(min-width: 1024px) ${captureWidth}px, (min-width: 768px) ${Math.round(44 * tile.zoom)}vw, ${Math.round(88 * tile.zoom)}vw`}
                className="absolute top-0 left-0 block h-auto max-w-none"
                style={{ width: `${tile.zoom * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <h3 className="mt-5 text-lg leading-tight font-semibold tracking-[-0.015em]">{tidy(feature.title)}</h3>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-pretty text-muted">
        <Typo>{feature.body}</Typo>
      </p>
    </article>
  );
}

/** The six features as two short rows of tiles in three different widths. */
export function Features() {
  return (
    <section id="funkce" className="wrap pt-24 pb-20 lg:pt-36 lg:pb-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="display-section">{FEATURES_INTRO.title}</h2>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          {tidy("Žádné makety. Každý snímek obrazovky na této stránce je z běžící aplikace.")}
        </p>
      </div>

      <ul className="mt-10 grid gap-x-6 gap-y-10 md:grid-cols-2 lg:mt-12 lg:grid-cols-12 lg:gap-y-12">
        {TILES.map(([id, tile], index) => {
          const feature = FEATURES.find((item) => item.id === id);
          return feature ? (
            <li key={id} className={tile.span}>
              <FeatureTile
                feature={feature}
                tile={tile}
                painting={index % 2 === 0 ? PHOTOS.planMalba : PHOTOS.poleMalba}
              />
            </li>
          ) : null;
        })}
      </ul>
    </section>
  );
}
