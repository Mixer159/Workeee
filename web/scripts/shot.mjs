#!/usr/bin/env node
/**
 * Screenshots and a mechanical audit of one page, for visual review.
 *
 *   pnpm shot index           the landing page, "/"
 *   pnpm shot zmeny           "/zmeny"
 *   pnpm shot <slug> --thumb  also writes public/thumbs/<slug>.png for the index
 *
 * Needs the dev server on http://localhost:3210 (`pnpm dev`). Uses the Edge or
 * Chrome already installed on the machine, so nothing is downloaded.
 *
 * Output in .shots/<slug>/:
 *   overview-NN.png  the whole page at 1440 px, half scale, for layout and rhythm
 *   desktop-NN.png   the whole page at 1440 x 900, full scale, in 1200 px slices
 *   mobile-NN.png    the whole page at 390 x 844, in 1600 px slices
 *   report.json      the audit below, also printed
 *
 * The audit catches what can be measured: horizontal overflow, broken images,
 * missing alt text, disclosure widgets, pure black backgrounds, endless
 * animations, em dashes, dead links, console errors and failed requests. It
 * does not judge the design; that is what the pictures are for.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string", default: "http://localhost:3210" },
    out: { type: "string", default: ".shots" },
    thumb: { type: "boolean", default: false },
    // Keep the variant switcher visible in the pictures.
    "keep-switcher": { type: "boolean", default: false },
  },
});

const target = positionals[0];
if (!target) {
  console.error("Usage: pnpm shot <slug|index> [--thumb] [--keep-switcher] [--base URL] [--out DIR]");
  process.exit(2);
}

const route = target === "index" ? "/" : `/${target.replace(/^\/+/, "")}`;
const name = target === "index" ? "index" : route.slice(1).replace(/\//g, "-");
const url = new URL(route, values.base).href;
const outDir = path.resolve(values.out, name);

const VIEWS = [
  { id: "overview", width: 1440, height: 900, scale: 0.5, slice: 2400, audit: false },
  { id: "desktop", width: 1440, height: 900, scale: 1, slice: 1200, audit: true },
  { id: "mobile", width: 390, height: 844, scale: 1, slice: 1600, audit: true, mobile: true },
];

async function launch() {
  let lastError;
  for (const channel of ["msedge", "chrome"]) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** Scrolls through the page so lazy images load and scroll reveals run. */
async function settle(page) {
  await page.evaluate(async () => {
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const step = Math.round(window.innerHeight * 0.7);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: "instant" });
      await pause(90);
    }
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    await pause(150);
    await Promise.race([
      Promise.all(
        [...document.images].map((image) =>
          image.complete
            ? null
            : new Promise((resolve) => {
                image.addEventListener("load", resolve, { once: true });
                image.addEventListener("error", resolve, { once: true });
              }),
        ),
      ),
      pause(8000),
    ]);
    await document.fonts.ready;
    window.scrollTo({ top: 0, behavior: "instant" });
    await pause(400);
  });
}

/** Runs in the page. Returns only what can be measured. */
function audit() {
  const viewportWidth = document.documentElement.clientWidth;
  const describe = (element) => {
    const id = element.id ? `#${element.id}` : "";
    const classes =
      typeof element.className === "string" && element.className.trim()
        ? `.${element.className.trim().split(/\s+/).slice(0, 3).join(".")}`
        : "";
    const text = (element.innerText || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${element.tagName.toLowerCase()}${id}${classes}${text ? ` "${text}"` : ""}`.slice(0, 160);
  };
  const clippedByAncestor = (element) => {
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (getComputedStyle(parent).overflowX !== "visible") return true;
    }
    return false;
  };

  const overflowBy = document.documentElement.scrollWidth - viewportWidth;
  const overflowOffenders = [];
  if (overflowBy > 1) {
    for (const element of document.querySelectorAll("body *")) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if ((rect.right > viewportWidth + 1 || rect.left < -1) && !clippedByAncestor(element)) {
        overflowOffenders.push(`${describe(element)} [${Math.round(rect.left)}..${Math.round(rect.right)}]`);
        if (overflowOffenders.length >= 8) break;
      }
    }
  }

  const pureBlack = [];
  const endlessAnimations = [];
  const smallText = [];
  for (const element of document.querySelectorAll("body, body *")) {
    if (element.closest("[data-variant-switcher]")) continue;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (style.backgroundColor === "rgb(0, 0, 0)" && rect.width * rect.height > 4000) {
      pureBlack.push(describe(element));
    }
    for (const pseudo of [null, "::before", "::after"]) {
      const pseudoStyle = pseudo ? getComputedStyle(element, pseudo) : style;
      if (
        pseudoStyle.animationName !== "none" &&
        pseudoStyle.animationIterationCount.split(",").some((count) => count.trim() === "infinite")
      ) {
        endlessAnimations.push(`${describe(element)}${pseudo ?? ""} (${pseudoStyle.animationName})`);
      }
    }
    const ownText = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
    // Text inside an aria-hidden illustration (the moving hero board redraws
    // the capture's own tiny counts) is part of a picture, like text in a
    // screenshot, so it is not held to the reading size.
    if (
      ownText &&
      rect.width > 0 &&
      parseFloat(style.fontSize) < 12 &&
      style.visibility !== "hidden" &&
      !element.closest('[aria-hidden="true"]')
    ) {
      smallText.push(`${describe(element)} (${style.fontSize})`);
    }
  }

  const visibleText = document.body.innerText;
  const anchors = [...document.querySelectorAll("a")].filter((a) => !a.closest("[data-variant-switcher]"));

  return {
    title: document.title,
    lang: document.documentElement.lang,
    pageHeight: document.documentElement.scrollHeight,
    h1Count: document.querySelectorAll("h1").length,
    fontsLoaded: [...new Set([...document.fonts].filter((font) => font.status === "loaded").map((font) => font.family.replace(/["']/g, "")))],
    overflowBy: overflowBy > 1 ? overflowBy : 0,
    overflowOffenders,
    brokenImages: [...document.images].filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.currentSrc || image.src),
    imagesWithoutAlt: [...document.images].filter((image) => !image.hasAttribute("alt")).map((image) => image.currentSrc || image.src),
    disclosureWidgets: document.querySelectorAll("details, summary").length,
    pureBlack: pureBlack.slice(0, 8),
    endlessAnimations: endlessAnimations.slice(0, 8),
    emDashes: (visibleText.match(/—/g) || []).length,
    linksWithoutTarget: anchors.filter((a) => !a.getAttribute("href") || a.getAttribute("href") === "#").map(describe),
    deadAnchors: anchors
      .map((a) => a.getAttribute("href") || "")
      .filter((href) => href.startsWith("#") && href.length > 1 && !document.getElementById(href.slice(1))),
    // A hidden control (a closed menu's links) is out of everyone's reach,
    // and its innerText is empty, so only visible controls are checked.
    controlsWithoutName: [...document.querySelectorAll("a, button")]
      .filter(
        (control) =>
          control.checkVisibility({ visibilityProperty: true }) &&
          !(control.innerText || "").trim() &&
          !control.getAttribute("aria-label") &&
          !control.getAttribute("aria-labelledby") &&
          !control.querySelector("img[alt]:not([alt=''])"),
      )
      .map(describe),
    smallText: smallText.slice(0, 8),
  };
}

const PROBLEM_KEYS = [
  "overflowOffenders",
  "brokenImages",
  "imagesWithoutAlt",
  "pureBlack",
  "endlessAnimations",
  "linksWithoutTarget",
  "deadAnchors",
  "controlsWithoutName",
  "smallText",
  "consoleErrors",
  "failedRequests",
];

function summarize(viewId, report) {
  const lines = [];
  if (report.overflowBy) lines.push(`horizontal overflow by ${report.overflowBy}px`);
  if (report.disclosureWidgets) lines.push(`${report.disclosureWidgets} details/summary elements`);
  if (report.emDashes) lines.push(`${report.emDashes} em dashes in visible text`);
  if (report.h1Count !== 1) lines.push(`${report.h1Count} h1 elements (expected 1)`);
  if (report.lang !== "cs") lines.push(`html lang is "${report.lang}" (expected "cs")`);
  for (const key of PROBLEM_KEYS) {
    if (report[key]?.length) lines.push(`${key}: ${report[key].join(" | ")}`);
  }
  console.log(`\n[${viewId}] ${report.pageHeight}px tall, fonts: ${report.fontsLoaded.join(", ") || "none loaded"}`);
  console.log(lines.length ? lines.map((line) => `  PROBLEM ${line}`).join("\n") : "  audit clean");
  return lines.length;
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const browser = await launch();
const report = { url, views: {} };
let problems = 0;

try {
  for (const view of VIEWS) {
    const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      deviceScaleFactor: view.scale,
      isMobile: Boolean(view.mobile),
      hasTouch: Boolean(view.mobile),
      locale: "cs-CZ",
    });
    const page = await context.newPage();
    const consoleErrors = [];
    const failedRequests = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text().slice(0, 300));
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error).slice(0, 300)));
    page.on("response", (response) => {
      if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
    });

    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    if (!response || response.status() >= 400) {
      throw new Error(`${url} answered ${response ? response.status() : "nothing"}`);
    }
    if (!values["keep-switcher"]) {
      await page.addStyleTag({ content: "[data-variant-switcher]{display:none!important}" });
    }
    await settle(page);

    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const files = [];
    for (let y = 0, index = 1; y < pageHeight; y += view.slice, index += 1) {
      const file = path.join(outDir, `${view.id}-${String(index).padStart(2, "0")}.png`);
      await page.screenshot({
        path: file,
        fullPage: true,
        clip: { x: 0, y, width: view.width, height: Math.min(view.slice, pageHeight - y) },
      });
      files.push(file);
    }
    console.log(`[${view.id}] ${files.length} file(s): ${path.relative(process.cwd(), files[0])} .. ${path.basename(files[files.length - 1])}`);

    if (view.audit) {
      const result = { ...(await page.evaluate(audit)), consoleErrors, failedRequests };
      report.views[view.id] = result;
      problems += summarize(view.id, result);
    }

    if (values.thumb && view.id === "overview") {
      const thumbDir = path.resolve("public", "thumbs");
      await mkdir(thumbDir, { recursive: true });
      await page.screenshot({ path: path.join(thumbDir, `${name}.png`) });
    }
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`\n${problems ? `${problems} problem line(s)` : "No audit problems"}. Report: ${path.relative(process.cwd(), path.join(outDir, "report.json"))}`);
