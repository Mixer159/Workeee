import type { Metadata } from "next";
import { ChangelogSection } from "@/components/marketing/changelog-section";
import { Facts } from "@/components/marketing/facts";
import { Hero } from "@/components/marketing/hero";
import { Ledger } from "@/components/marketing/ledger";
import { OpenSource } from "@/components/marketing/open-source";
import { Product } from "@/components/marketing/product";
import { SelfHosting } from "@/components/marketing/self-hosting";

const DESCRIPTION =
  "Projekty, nástěnka s vlastními stavy, úkoly s blokovým popisem, přílohy a komentáře. Open source, běží na vašem Convexu a vašem Vercelu.";

/**
 * `openGraph` here replaces the root layout's rather than merging into it, so
 * `siteName` / `locale` / `type` are repeated in full. `images` is left out on
 * purpose: that omission is what lets `opengraph-image.tsx` next door supply
 * the picture.
 *
 * The canonical is here because this page is served twice: at its own address
 * and, through the rewrite in `src/proxy.ts`, on `/` for anybody without a
 * session. One of the two has to be the real one, and it is this one.
 */
export const metadata: Metadata = {
  title: "Workeee: projekty a úkoly pro tým",
  description: DESCRIPTION,
  alternates: { canonical: "/o-aplikaci" },
  openGraph: {
    type: "website",
    siteName: "Workeee",
    locale: "cs_CZ",
    title: "Workeee: projekty a úkoly pro tým",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Workeee: projekty a úkoly pro tým",
    description: DESCRIPTION,
  },
};

/**
 * The public page. Server-rendered and static: a crawler and a chat unfurl have
 * to find the real copy in the HTML, and nothing here needs a database. The one
 * client component on it is the link onward for somebody already signed in;
 * even the scroll choreography is CSS.
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <Facts />
      <Product />
      <Ledger />
      <SelfHosting />
      <OpenSource />
      <ChangelogSection />
    </>
  );
}
