import type { Metadata } from "next";
import { JoinScreen } from "@/components/join/join-screen";

const TITLE = "Pozvánka do Workeee";
const DESCRIPTION = "Připojte se k organizaci ve Workeee.";

/**
 * `openGraph` replaces the layout's copy rather than merging into it, so the
 * fields an unfurl reads are repeated here in full. `images` is deliberately
 * absent: leaving it out is what lets `opengraph-image.tsx` beside this file
 * supply the picture.
 */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Workeee",
    locale: "cs_CZ",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <JoinScreen code={decodeURIComponent(code)} />;
}
