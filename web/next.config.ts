import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev overlay button would show up in the review screenshots.
  devIndicators: false,
  // 75 is the default. The board captures in the hero use 90, because small
  // interface text loses its edges at 75; the paintings use 60, where their
  // brushwork hides the compression (PAINTING_QUALITY in src/lib/photos.ts).
  images: { qualities: [60, 75, 90] },
};

export default nextConfig;
