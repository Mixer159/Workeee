/**
 * The oil paintings in public/malby: Vincent van Gogh reproductions from
 * Wikimedia Commons, all public domain. Sources are in design/photo-credits.md.
 * They are the only imagery of the pages besides the app's own screenshots.
 * They are decoration with texture that hides compression, so the pages load
 * them at PAINTING_QUALITY rather than the default 75.
 */
export const PAINTING_QUALITY = 60;

export type Photo = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

export const PHOTOS = {
  /** Wheatfield under Thunderclouds (1890). Deep blue sky over the upper 60 %, green fields below. */
  poleMalba: {
    src: "/malby/pole-pod-mraky.jpg",
    width: 1920,
    height: 948,
    alt: "Vincent van Gogh: Obilné pole pod bouřkovými mraky, olejomalba z roku 1890.",
  },
  /** The Plain of Auvers (1890). Lighter teal sky with trees, green fields; unpainted canvas edge along the top. */
  planMalba: {
    src: "/malby/plan-u-auvers.jpg",
    width: 1920,
    height: 936,
    alt: "Vincent van Gogh: Pláň u Auvers, olejomalba z roku 1890.",
  },
  /**
   * Wheatfield under Thunderclouds again, in grey and multiplied by the grass
   * green, baked by scripts/tint-painting.mjs. The ground of the steps section.
   */
  poleMalbaZelena: {
    src: "/malby/pole-pod-mraky-zelene.jpg",
    width: 1920,
    height: 948,
    alt: "Vincent van Gogh: Obilné pole pod bouřkovými mraky, v zelených tónech.",
  },
} satisfies Record<string, Photo>;
