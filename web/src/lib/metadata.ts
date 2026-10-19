import type { Metadata } from "next";
import { SITE } from "@/lib/workeee";

/**
 * The link preview image of every page, made from the hero by
 * scripts/og-image.mjs. A plain public file rather than an
 * opengraph-image file next to the layout: a page that sets its own
 * openGraph replaces the layout's, file-based image included.
 */
export const OG_IMAGE = {
  url: "/og-image.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "Workeee, týmová nástěnka, která běží u vás: nástěnka úkolů se sloupci To-do, V průběhu a Hotovo v rámu z Van Goghovy malby.",
};

/**
 * A page's own metadata: its title and description, its canonical address
 * and the same for link previews. Next.js merges `openGraph` and `twitter`
 * shallowly, so a page that sets its address has to repeat the rest of them;
 * this keeps the pages from drifting apart.
 */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "cs_CZ",
      siteName: SITE.name,
      title,
      description,
      url: path,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  };
}
