import type { Metadata, Viewport } from "next";
import { Urbanist } from "next/font/google";
import type { ReactNode } from "react";
import { OG_IMAGE } from "@/lib/metadata";
import { SITE_URL } from "@/lib/site-url";
import { SITE } from "@/lib/workeee";
import "./vyber.css";

// One variable file covers the 90 px headline and the 16 px text. Czech
// diacritics need the latin-ext subset.
const urbanist = Urbanist({ subsets: ["latin", "latin-ext"], variable: "--font-urbanist" });

// The defaults; each page sets its own title, description and canonical
// address (pageMetadata in src/lib/metadata.ts).
export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: SITE.title,
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: {
    type: "website",
    locale: "cs_CZ",
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [OG_IMAGE] },
};
// The sky of the hero is the first thing under the browser chrome.
export const viewport: Viewport = { themeColor: "#599ad2" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="cs" className={urbanist.variable}>
      <body className="font-sans">
        {children}
      </body>
    </html>
  );
}
