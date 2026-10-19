/**
 * The oil paintings in public/marketing/malby: Vincent van Gogh (1853–1890)
 * reproductions from Wikimedia Commons, public domain, credited in the
 * footer. Sources:
 *
 * - Wheatfield under Thunderclouds, Van Gogh Museum, Amsterdam:
 *   https://commons.wikimedia.org/wiki/File:Vincent_van_Gogh_-_Wheatfield_under_thunderclouds_-_Google_Art_Project.jpg
 * - The Plain of Auvers, Belvedere, Vienna:
 *   https://commons.wikimedia.org/wiki/File:Vincent_van_Gogh_-_Die_Ebene_von_Auvers_-_1007_-_%C3%96sterreichische_Galerie_Belvedere.jpg
 *
 * They are the only imagery of the public pages besides the app's own screenshots.
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
    src: "/marketing/malby/pole-pod-mraky.jpg",
    width: 1920,
    height: 948,
    alt: "Vincent van Gogh: Obilné pole pod bouřkovými mraky, olejomalba z roku 1890.",
  },
  /** The Plain of Auvers (1890). Lighter teal sky with trees, green fields; unpainted canvas edge along the top. */
  planMalba: {
    src: "/marketing/malby/plan-u-auvers.jpg",
    width: 1920,
    height: 936,
    alt: "Vincent van Gogh: Pláň u Auvers, olejomalba z roku 1890.",
  },
  /**
   * Wheatfield under Thunderclouds again, turned grey and multiplied by the
   * grass green (#46652f), baked into the file. The ground of the steps
   * section.
   */
  poleMalbaZelena: {
    src: "/marketing/malby/pole-pod-mraky-zelene.jpg",
    width: 1920,
    height: 948,
    alt: "Vincent van Gogh: Obilné pole pod bouřkovými mraky, v zelených tónech.",
  },
} satisfies Record<string, Photo>;
