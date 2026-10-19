import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.convex.cloud",
  "font-src 'self' data:",
  "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud",
  "media-src 'self' blob: https://*.convex.cloud",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  /*
   * 75 is the default and the only quality Next.js serves unless told. The
   * public page asks for two more: 90 for the board captures in the hero,
   * because small interface text loses its edges at 75, and 60 for the
   * paintings, whose brushwork hides the compression. Anything not listed
   * here is answered with a 400 and the picture is simply missing.
   */
  images: { qualities: [60, 75, 90] },
  /*
   * The link previews draw their type with Satori, which reads the two static
   * Switzer cuts straight off disk. The invite preview is rendered on demand
   * rather than at build, so those two files have to be traced into the
   * serverless bundle or the unfurl silently falls back to a bundled face.
   */
  outputFileTracingIncludes: {
    "/**/opengraph-image": ["./src/app/fonts/Switzer-*.woff"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
