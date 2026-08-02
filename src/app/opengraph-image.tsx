import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Workeee — interní aplikace pro týmy, projekty a úkoly.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** The preview every page inherits unless it draws its own. */
export default function OpengraphImage() {
  return renderOgImage({
    title: "Interní aplikace pro týmy, projekty a úkoly.",
  });
}
