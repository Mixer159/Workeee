import type { CSSProperties } from "react";
import { ImageResponse } from "next/og";

/**
 * The canvas every link preview is drawn on — one layout, shared by the
 * dashboard and the invite page, so an unfurl always looks like the same
 * product. Colors are the dark theme's tokens spelled out, because Satori never
 * sees `globals.css`.
 */

/** 1200 × 630 — what Slack, Teams, X, LinkedIn and Messenger all expect. */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const BACKGROUND = "#121212";
const FOREGROUND = "#f5f5f5";
const MUTED = "#a3a3a3";
const BRAND = "#4f46e5";
const BRAND_LIGHT = "#6e67e9";

/**
 * The mark, spelled out again because Satori cannot import `src/app/icon.svg` —
 * it is not the DOM and there is no loader in front of it. The two files carry
 * the same path and have to be changed together.
 */
const MARK = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">',
  '<rect width="64" height="64" rx="14.5" fill="#4f46e5"/>',
  '<path d="M13 19 H20.5 L25.27 30.28 L32 19 L38.73 30.28 L43.5 19 H51 L40 45 L32 31.58 L24 45 Z"',
  ' fill="#ffffff" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>',
  "</svg>",
].join("");

const MARK_SRC = `data:image/svg+xml;base64,${Buffer.from(MARK).toString("base64")}`;

/**
 * Google Fonts answers this ancient user agent with a plain `.woff`, which
 * Satori can parse. The modern answer is `.woff2`, which it cannot.
 */
const LEGACY_USER_AGENT =
  "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/12.0.742.112 Safari/534.30";

type FontWeight = 400 | 600;

async function loadGeist(weight: FontWeight) {
  const stylesheet = await fetch(
    `https://fonts.googleapis.com/css2?family=Geist:wght@${weight}`,
    { headers: { "User-Agent": LEGACY_USER_AGENT }, cache: "force-cache" },
  );
  if (!stylesheet.ok) {
    throw new Error(`Geist ${weight}: ${stylesheet.status}`);
  }

  const source = /src: url\(([^)]+)\) format\('(?:woff|truetype|opentype)'\)/.exec(
    await stylesheet.text(),
  )?.[1];
  if (!source) {
    throw new Error(`Geist ${weight}: no parsable font file in the stylesheet`);
  }

  const file = await fetch(source, { cache: "force-cache" });
  if (!file.ok) {
    throw new Error(`Geist ${weight}: ${file.status}`);
  }

  return {
    name: "Geist",
    data: await file.arrayBuffer(),
    weight,
    style: "normal" as const,
  };
}

/**
 * The app already downloads Geist from Google at build time through
 * `next/font`, so asking for it here adds no new dependency. When it cannot be
 * had, the fonts are dropped entirely and `ImageResponse` falls back to its own
 * bundled face — a preview in the wrong typeface still beats no preview.
 */
async function loadFonts() {
  try {
    return await Promise.all([loadGeist(400), loadGeist(600)]);
  } catch {
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
          padding: "76px 80px",
          backgroundColor: BACKGROUND,
          /* One warm corner, so the canvas is not a flat rectangle. Painted on
             the canvas itself: an absolutely positioned circle gets clipped by
             Satori's layout box and shows its edges. */
          backgroundImage:
            "radial-gradient(circle at 82% 6%, rgba(110,103,233,0.42), rgba(110,103,233,0) 58%)",
          color: FOREGROUND,
          fontFamily: "Geist",
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
            <img src={MARK_SRC} width={76} height={76} alt="" />
            <div
              style={{
                marginLeft: 22,
                fontSize: 36,
                fontWeight: 600,
                letterSpacing: -0.8,
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
                padding: "12px 26px",
                borderRadius: 999,
                border: `1px solid ${BRAND_LIGHT}59`,
                backgroundColor: `${BRAND}33`,
                color: "#c9c6f8",
                fontSize: 26,
                fontWeight: 600,
              }}
            >
              {eyebrow}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <Line
            text={title}
            space={13}
            style={{
              maxWidth: 900,
              fontSize: 68,
              fontWeight: 600,
              lineHeight: 1.16,
              letterSpacing: -2,
            }}
          />
          {subtitle ? (
            <Line
              text={subtitle}
              space={6}
              style={{
                marginTop: 24,
                maxWidth: 820,
                fontSize: 30,
                color: MUTED,
                letterSpacing: -0.4,
              }}
            />
          ) : null}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
