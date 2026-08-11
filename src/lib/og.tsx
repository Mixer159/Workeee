import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CSSProperties } from "react";
import { ImageResponse } from "next/og";

/**
 * The canvas every link preview is drawn on — one layout, shared by the public
 * page, the app and the invite page, so an unfurl always looks like the same
 * product. Colors are the dark theme's tokens spelled out, because Satori never
 * sees `globals.css`.
 */

/** 1200 × 630 — what Slack, Teams, X, LinkedIn and Messenger all expect. */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const BACKGROUND = "#0B0C0F";
const FOREGROUND = "#F3F5F7";
const MUTED = "#969FAB";
const ACCENT = "#CBF14B";

/**
 * The mark, spelled out again because Satori cannot import `src/app/icon.svg` —
 * it is not the DOM and there is no loader in front of it. Same four shapes as
 * the icon and as `components/brand/mark.tsx`; all three change together.
 */
const MARK = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 44" width="48" height="44">',
  `<g fill="${ACCENT}">`,
  '<rect x="0" y="0" width="12" height="44" rx="3"/>',
  '<rect x="18" y="14" width="12" height="30" rx="3"/>',
  '<rect x="36" y="28" width="12" height="16" rx="3"/>',
  '<rect x="36" y="10" width="12" height="10" rx="3"/>',
  "</g></svg>",
].join("");

const MARK_SRC = `data:image/svg+xml;base64,${Buffer.from(MARK).toString("base64")}`;

/**
 * Switzer, read off disk rather than fetched.
 *
 * Satori parses TTF, OTF and WOFF and chokes on WOFF2, and it renders a
 * variable font at its default instance — so the two static cuts beside the
 * variable file are here for exactly this, and for nothing else. Reading them
 * locally is also what makes an unfurl independent of a font CDN being up at
 * the moment somebody pastes a link. `next.config.ts` traces the folder into
 * the serverless bundle, because the invite preview is rendered on demand.
 */
const FONT_DIR = path.join(process.cwd(), "src", "app", "fonts");

async function loadFonts() {
  try {
    const [regular, extrabold] = await Promise.all([
      readFile(path.join(FONT_DIR, "Switzer-400.woff")),
      readFile(path.join(FONT_DIR, "Switzer-800.woff")),
    ]);
    return [
      {
        name: "Switzer",
        data: regular,
        weight: 400 as const,
        style: "normal" as const,
      },
      {
        name: "Switzer",
        data: extrabold,
        weight: 800 as const,
        style: "normal" as const,
      },
    ];
  } catch {
    // A preview in the wrong typeface still beats no preview.
    return undefined;
  }
}

/**
 * A line of copy, set word by word.
 *
 * Satori lays a text node out one word at a time and leaves the space between
 * them at its full width, so tightened type comes out with gaps that look
 * pulled apart — worst around short Czech words like "se" and "a". Making the
 * words flex items is what puts the word space back under our control; the
 * wrapping is unchanged, it is still decided by the width.
 */
function Line({
  text,
  space,
  style,
}: {
  text: string;
  space: number;
  style: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", ...style }}>
      {text.split(" ").map((word, index) => (
        <div key={`${index}-${word}`} style={{ marginRight: space }}>
          {word}
        </div>
      ))}
    </div>
  );
}

export async function renderOgImage({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "68px 76px",
          backgroundColor: BACKGROUND,
          /* One cold corner of accent light. Painted on the canvas itself: an
             absolutely positioned circle gets clipped by Satori's layout box
             and shows its edges. */
          backgroundImage:
            "radial-gradient(900px 620px at 108% 118%, rgba(203,241,75,0.16), rgba(203,241,75,0) 62%)",
          color: FOREGROUND,
          fontFamily: "Switzer",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders to a PNG; next/image has nothing to do here. */}
            <img src={MARK_SRC} width={44} height={40} alt="" />
            <div
              style={{
                marginLeft: 18,
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: -0.9,
              }}
            >
              Workeee
            </div>
          </div>

          {eyebrow ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 20px",
                borderRadius: 6,
                border: `1px solid ${ACCENT}55`,
                color: ACCENT,
                fontSize: 24,
              }}
            >
              {eyebrow}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* The one accent stroke, the same short rule the rail draws next to
              the project you have open. */}
          <div
            style={{
              width: 64,
              height: 4,
              borderRadius: 2,
              marginBottom: 34,
              backgroundColor: ACCENT,
            }}
          />
          <Line
            text={title}
            space={16}
            style={{
              maxWidth: 960,
              fontSize: 74,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: -3.4,
            }}
          />
          {subtitle ? (
            <Line
              text={subtitle}
              space={7}
              style={{
                marginTop: 26,
                maxWidth: 840,
                fontSize: 28,
                color: MUTED,
                letterSpacing: -0.3,
              }}
            />
          ) : null}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
