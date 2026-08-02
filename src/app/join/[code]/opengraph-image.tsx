import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Pozvánka do Workeee.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * An invite link is the one address people paste into a chat, so it gets its
 * own preview. It says nothing about *which* organization: the code is in the
 * URL, and an unfurl is cached and re-shared by the chat, not by the person who
 * was invited.
 */
export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: "Pozvánka",
    title: "Připojte se k organizaci",
    subtitle: "Interní aplikace pro týmy, projekty a úkoly.",
  });
}
