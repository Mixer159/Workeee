import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { Toaster } from "@/components/ui/sonner";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
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
