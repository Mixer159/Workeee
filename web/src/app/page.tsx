import type { Metadata } from "next";
import { Deploy } from "@/components/vyber/deploy";
import { Features } from "@/components/vyber/features";
import { Footer } from "@/components/vyber/footer";
import { Hero } from "@/components/vyber/hero";
import { LatestChanges } from "@/components/vyber/latest-changes";
import { Logos } from "@/components/vyber/logos";
import { Nav } from "@/components/vyber/nav";
import { Screens } from "@/components/vyber/screens";
import { SourceCode } from "@/components/vyber/source-code";
import { Statement } from "@/components/vyber/statement";
import { pageMetadata } from "@/lib/metadata";
import { absolute } from "@/lib/site-url";
import { SITE } from "@/lib/workeee";

export const metadata: Metadata = pageMetadata({ title: SITE.title, description: SITE.description, path: "/" });

/**
 * The site's name for search engines (schema.org WebSite). Only what the page
 * itself says: no ratings, prices or user counts.
 */
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.name,
  url: absolute("/"),
  inLanguage: "cs",
  description: SITE.description,
};

export default function VyberPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // "<" escaped, so nothing in the text can close the script element.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
      />
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
