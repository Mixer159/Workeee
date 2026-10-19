import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev overlay button would show up in the review screenshots.
  devIndicators: false,
  // 75 is the default. The board captures in the hero use 90, because small
  // interface text loses its edges at 75; the paintings use 60, where their
  // brushwork hides the compression (PAINTING_QUALITY in src/lib/photos.ts).
  images: { qualities: [60, 75, 90] },
  // This folder, not the repository. Inside the app's repo Next.js otherwise
  // takes the outer pnpm-lock.yaml as the root and compiles the app's
  // src/proxy.ts along with this site. That fails wherever only this
  // folder's dependencies are installed: in CI and on a Vercel project
  // whose Root Directory is web.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
