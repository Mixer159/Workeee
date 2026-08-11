import type { Metadata } from "next";
import localFont from "next/font/local";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { Toaster } from "@/components/ui/sonner";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

/**
 * Two faces, both self-hosted from `src/app/fonts`, both variable, both a
 * single file.
 *
 * **Switzer** carries everything a person reads: the 14 px label in the rail
 * and the display word on the public page are the same typeface at two ends of
 * one `wght` axis, which is the whole argument for a variable grotesque. It is
 * a cold Swiss neutral with a flat, unfriendly skeleton, and it holds at
 * weight 800 on a poster without turning into the rounded-grotesk look every
 * generated landing page wears. Its 385 glyphs cover Czech in full.
 *
 * **JetBrains Mono** has exactly one job: things a machine reads back. Shell
 * commands, environment-variable names, file paths, dates and counts. Nothing
 * else on either surface is set in it.
 *
 * Nothing is fetched from a font CDN at runtime, and nothing is fetched from
 * one at build time either.
 */
const switzer = localFont({
  src: "./fonts/Switzer-Variable.woff2",
  variable: "--font-switzer",
  weight: "100 900",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/JetBrainsMono-Variable.woff2",
  variable: "--font-jetbrains-mono",
  weight: "100 800",
  display: "swap",
});

const DESCRIPTION = "Interní aplikace pro týmy, projekty a úkoly.";

/**
 * `metadataBase` is what turns the generated icons and `opengraph-image` into
 * the absolute URLs an unfurl needs — the same origin invite links are built
 * from, so a misconfigured deployment gets both wrong at once instead of one
 * quietly.
 *
 * There is no `twitter.images`: X falls back to `og:image`, and a second copy
 * of the same picture is a second thing to keep in sync.
 */
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "Workeee",
  description: DESCRIPTION,
  applicationName: "Workeee",
  openGraph: {
    type: "website",
    siteName: "Workeee",
    locale: "cs_CZ",
    title: "Workeee",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Workeee",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="cs"
      suppressHydrationWarning
      className={`${switzer.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full">
        <ConvexClientProvider>
          {children}
          <Toaster position="top-right" />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
