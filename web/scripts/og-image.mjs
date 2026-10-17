#!/usr/bin/env node
/**
 * The link preview image (Open Graph and X) for every page, built from the
 * page's own material: the hero painting behind a white sheet, the headline,
 * and the board capture in the frame of the second painting. 1200 x 630.
 *
 *   node scripts/og-image.mjs
 *
 * Needs the dev server on http://localhost:3210 (`pnpm dev`) for the images,
 * and the network for Urbanist from Google Fonts. Writes public/og-image.jpg,
 * which OG_IMAGE in src/lib/metadata.ts names for every page.
 */
import { stat } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = "http://localhost:3210";
const OUT = "public/og-image.jpg";

const html = `<!doctype html>
<html lang="cs"><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Urbanist:wght@600&display=block">
<style>
  body { margin: 0; }
  .card { position: relative; width: 1200px; height: 630px; overflow: hidden; isolation: isolate; font-family: Urbanist, sans-serif; color: #111113; }
  .paint { position: absolute; inset: 0; z-index: -2; width: 100%; height: 100%; object-fit: cover; scale: 1.06; }
  .sheet { position: absolute; inset: 26px 26px 0; z-index: -1; border-radius: 24px 24px 0 0; background: #fff; }
  .mark { position: absolute; top: 58px; left: 70px; display: flex; align-items: center; gap: 12px; font-size: 26px; font-weight: 600; letter-spacing: -0.01em; }
  .mark svg { height: 24px; }
  h1 { position: absolute; top: 112px; left: 0; right: 0; margin: 0; text-align: center; font-size: 66px; font-weight: 600; line-height: 1.08; letter-spacing: -0.03em; }
  .frame { position: absolute; top: 300px; left: 50%; width: 800px; translate: -50% 0; height: 400px; padding: 14px 14px 0; border-radius: 24px 24px 0 0; overflow: hidden; }
  .frame .mat { position: absolute; inset: 0; z-index: -1; width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; }
  .white { height: 100%; padding: 6px; border-radius: 14px 14px 0 0; background: #fff; box-shadow: 0 24px 48px -16px rgb(10 30 60 / 0.5); }
  .window { height: 100%; overflow: hidden; border-radius: 8px 8px 0 0; }
  .window img { display: block; width: 100%; }
</style></head>
<body><div class="card">
  <img class="paint" src="${BASE}/malby/pole-pod-mraky.jpg" alt="">
  <div class="sheet"></div>
  <div class="mark"><svg viewBox="0 0 48 44"><rect x="0" y="0" width="12" height="44" rx="3"/><rect x="18" y="14" width="12" height="30" rx="3"/><rect x="36" y="28" width="12" height="16" rx="3" fill="#2a9d6f"/><rect x="36" y="10" width="12" height="10" rx="3"/></svg>Workeee</div>
  <h1>Týmová nástěnka,<br>která běží u vás</h1>
  <div class="frame">
    <img class="mat" src="${BASE}/malby/plan-u-auvers.jpg" alt="">
    <div class="white"><div class="window"><img src="${BASE}/screenshots/board.png" alt=""></div></div>
  </div>
</div></body></html>`;

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: OUT, type: "jpeg", quality: 86 });
await browser.close();
console.log(`${OUT}: ${Math.round((await stat(OUT)).size / 1024)} KB`);
