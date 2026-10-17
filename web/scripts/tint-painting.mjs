#!/usr/bin/env node
/**
 * The ground of "Jak se s Workeee pracuje": the hero painting (Wheatfield
 * under Thunderclouds) in grey, its contrast lowered and multiplied by the
 * grass green, baked into one file. The browser then shows a plain picture
 * instead of filtering and blending the full-size painting on every frame,
 * and the low-contrast green compresses to a fraction of the original.
 *
 *   node scripts/tint-painting.mjs
 *
 * Needs the dev server on http://localhost:3210 (`pnpm dev`). Writes
 * public/malby/pole-pod-mraky-zelene.jpg at the reproduction's own size.
 * Change the values below and run it again to retint.
 */
import { stat } from "node:fs/promises";
import { chromium } from "playwright-core";

const SOURCE = "http://localhost:3210/malby/pole-pod-mraky.jpg";
const OUT = "public/malby/pole-pod-mraky-zelene.jpg";
const WIDTH = 1920;
const HEIGHT = 948;
/** The grass green of the section (--color-grass). */
const GREEN = "#46652f";
/** Grey, flatter and lighter, so that nothing comes out lighter than GREEN. */
const FILTER = "grayscale(1) contrast(0.55) brightness(1.5)";

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
await page.setContent(`<body style="margin:0">
  <div style="position:relative;width:${WIDTH}px;height:${HEIGHT}px;isolation:isolate;background:${GREEN}">
    <img src="${SOURCE}" style="position:absolute;inset:0;width:100%;height:100%;filter:${FILTER}" alt="">
    <span style="position:absolute;inset:0;background:${GREEN};mix-blend-mode:multiply"></span>
  </div>
</body>`);
await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
await page.screenshot({ path: OUT, type: "jpeg", quality: 80 });
await browser.close();
console.log(`${OUT}: ${Math.round((await stat(OUT)).size / 1024)} KB`);
