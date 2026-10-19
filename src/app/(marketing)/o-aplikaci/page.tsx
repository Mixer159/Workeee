import type { Metadata, Viewport } from "next";
import { Deploy } from "@/components/marketing/deploy";
import { Features } from "@/components/marketing/features";
import { Footer } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";
import { LatestChanges } from "@/components/marketing/latest-changes";
import { Logos } from "@/components/marketing/logos";
import { Nav } from "@/components/marketing/nav";
import { Screens } from "@/components/marketing/screens";
import { SourceCode } from "@/components/marketing/source-code";
import { Statement } from "@/components/marketing/statement";
import { SITE } from "@/lib/landing";

/**
 * `openGraph` here replaces the root layout's rather than merging into it, so
 * `siteName` / `locale` / `type` are repeated in full. `images` is left out on
 * purpose: that omission is what lets `opengraph-image.jpg` next door supply
 * the picture.
 *
 * The canonical is here because this page is served twice: at its own address
 * and, through the rewrite in `src/proxy.ts`, on `/` for anybody without a
 * session. One of the two has to be the real one, and it is this one.
 */
export const metadata: Metadata = {
  title: SITE.title,
  description: SITE.description,
  alternates: { canonical: "/o-aplikaci" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "cs_CZ",
    title: SITE.title,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.description,
  },
};

/** The sky of the hero is the first thing under the browser chrome. */
export const viewport: Viewport = { themeColor: "#599ad2" };

/**
 * The public page. Server-rendered and static: a crawler and a chat unfurl
 * have to find the real copy in the HTML, and nothing here needs a database.
 * The client parts are the bar's menu and its link onward, the copy buttons
 * and the moving board in the hero.
 */
export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Logos />
        <Statement />
        <Screens />
        <Features />
        <Deploy />
        <SourceCode />
        <LatestChanges />
      </main>
      <Footer />
    </>
  );
}
