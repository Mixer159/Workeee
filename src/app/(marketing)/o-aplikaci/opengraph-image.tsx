import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Workeee: projekty a úkoly pro tým, které si hostujete sami.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * The public page's own preview, on the same canvas as the other two.
 *
 * It has to sit beside `page.tsx` rather than be inherited from the app root:
 * a page that declares its own `openGraph` block loses the image the parent
 * segment would have supplied, and keeps only the one co-located with it. The
 * landing page declares one because its title and description are its own.
 */
export default function OpengraphImage() {
  return renderOgImage({
    title: "Projekty a úkoly pro tým, které si hostujete sami.",
    subtitle: "Open source. Vlastní Convex, vlastní Vercel, vlastní data.",
  });
}
