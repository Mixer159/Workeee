/**
 * The one gate an SVG icon passes through.
 *
 * SVG is the only image format that is also a document: opened as a page it
 * runs script, loads remote content and shares the origin it was served from.
 * That is why `lib/files.ts` blocklists it for attachments and why
 * `projects.setIcon` refuses it for an uploaded blob — a blob has a URL, and a
 * URL can be opened.
 *
 * A project icon may still be an SVG, because the two halves of that danger are
 * both removed rather than mitigated:
 *
 * 1. **It never becomes a blob.** The sanitized markup is stored on the project
 *    document and served to the browser as a `data:` URI inside `<img>`. An
 *    `<img>` is a passive context — no script, no external requests — and every
 *    browser has refused top-level navigation to a `data:` URI for years, so
 *    there is no page for anything to execute in even if this file is wrong.
 * 2. **The markup is validated, not cleaned.** Everything below is an
 *    allowlist: an element, an attribute or a construct this module cannot
 *    prove harmless is *refused*, with a sentence naming what it was. Cleaning
 *    means guessing what a browser will make of the leftovers; refusing does
 *    not.
 *
 * The parser is deliberately stricter than XML — unquoted attribute values,
 * CDATA sections, doctypes, processing instructions and numeric character
 * references are all refused, not because each one is an exploit but because
 * each one is a place where this module's reading and the browser's could
 * differ. An icon exported by any drawing program needs none of them.
 */

/**
 * Small enough to ride along in `projects.listVisible`, which every screen in
 * the app subscribes to. An exported icon is a few kilobytes; something an
 * order of magnitude bigger is an illustration, and it belongs in a PNG.
 */
export const MAX_ICON_SVG_BYTES = 32 * 1024;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** Shapes, structure, gradients, clipping and text. Nothing that loads. */
const ALLOWED_ELEMENTS = new Set([
  "svg",
  "g",
  "defs",
  "symbol",
  "use",
  "title",
  "desc",
  "style",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
  "pattern",
]);

/**
 * Geometry, paint and layout. No `href` except the local reference handled
 * separately below, and nothing that names a document, a script or a font file.
 */
const ALLOWED_ATTRIBUTES = new Set([
  "xmlns",
  "xmlns:xlink",
  "version",
  "viewBox",
  "preserveAspectRatio",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "transform",
  "gradientTransform",
  "gradientUnits",
  "spreadMethod",
  "offset",
  "stop-color",
  "stop-opacity",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "color",
  "display",
  "visibility",
  "clip-path",
  "clip-rule",
  "clipPathUnits",
  "mask",
  "maskUnits",
  "maskContentUnits",
  "patternUnits",
  "patternContentUnits",
  "paint-order",
  "shape-rendering",
  "vector-effect",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "letter-spacing",
  "text-anchor",
  "dominant-baseline",
  "dx",
  "dy",
  "id",
  "class",
  "style",
  "role",
  "focusable",
  "xml:space",
]);

/**
 * Inert metadata every drawing program sprinkles over an export (`data-name`
 * from Figma, `aria-hidden` from icon sets). The value is held to the same rule
 * as any other, so allowing the prefix costs nothing and saves a person from a
 * refusal they cannot act on.
 */
const ALLOWED_ATTRIBUTE_PREFIXES = ["data-", "aria-"];

/** `use` and `mask` reference a shape defined earlier in the same document. */
const LOCAL_REFERENCE_ATTRIBUTES = new Set(["href", "xlink:href"]);

const LOCAL_REFERENCE = /^#[A-Za-z][\w.:-]*$/;

/** The five XML entities. A numeric reference is refused — see the note above. */
const ALLOWED_ENTITY = /^&(amp|lt|gt|quot|apos);/;

export type SvgCheck = { ok: true; svg: string } | { ok: false; error: string };

/**
 * Validate an SVG and hand back the markup that may be stored, or the Czech
 * sentence explaining what stopped it.
 */
export function sanitizeIconSvg(input: string): SvgCheck {
  if (input.length > MAX_ICON_SVG_BYTES) {
    return { ok: false, error: "SVG může mít nejvýš 32 kB." };
  }
  // A NUL or other C0 control byte truncates the document for some parsers
  // and not for others, which is exactly the kind of disagreement this module
  // refuses to have.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input)) {
    return { ok: false, error: "SVG je poškozené." };
  }

  const stripped = stripPrologue(input);
  if (!stripped.ok) {
    return stripped;
  }
  return parse(stripped.svg);
}

/** The markup as a `data:` URI — the only way an icon SVG is ever served. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Drop the XML declaration and every comment, and refuse the rest of what can
 * appear before or between elements: a doctype (entity expansion), a CDATA
 * section (a second set of parsing rules) or a processing instruction.
 */
function stripPrologue(input: string): SvgCheck {
  let svg = input.trim();

  if (svg.startsWith("<?xml")) {
    const end = svg.indexOf("?>");
    if (end === -1) {
      return { ok: false, error: "SVG je poškozené." };
    }
    svg = svg.slice(end + 2).trim();
  }

  let index = svg.indexOf("<!--");
  while (index !== -1) {
    const end = svg.indexOf("-->", index + 4);
    if (end === -1) {
      return { ok: false, error: "SVG je poškozené." };
    }
    svg = svg.slice(0, index) + svg.slice(end + 3);
    index = svg.indexOf("<!--");
  }
  // A file that opens with a licence comment leaves a newline behind it, and
  // the root element has to be what starts the document.
  svg = svg.trim();

  if (svg.includes("<!") || svg.includes("<?")) {
    return {
      ok: false,
      error:
        "SVG obsahuje DOCTYPE nebo sekci CDATA. Uložte ho prosím jako čisté SVG.",
    };
  }
  if (!svg.startsWith("<svg")) {
    return { ok: false, error: "Soubor není SVG." };
  }
  return { ok: true, svg };
}

/**
 * One pass over the document: every tag is read whole, every attribute is
 * checked, and the element stack has to close. A malformed file is refused
 * here rather than rendering as an empty tile in the sidebar.
 */
function parse(svg: string): SvgCheck {
  const stack: string[] = [];
  /** Where `xmlns` goes if the root has none. */
  let rootAttributesAt = -1;
  let rootHasNamespace = false;
  let inStyle = false;
  let position = 0;

  while (position < svg.length) {
    const next = svg.indexOf("<", position);
    if (next === -1) {
      const rest = svg.slice(position);
      if (rest.trim().length > 0) {
        return { ok: false, error: "SVG je poškozené." };
      }
      break;
    }

    const text = svg.slice(position, next);
    const textCheck = inStyle ? checkStyleSheet(text) : checkText(text);
    if (!textCheck.ok) {
      return textCheck;
    }

    if (svg.startsWith("</", next)) {
      const end = svg.indexOf(">", next);
      if (end === -1) {
        return { ok: false, error: "SVG je poškozené." };
      }
      const name = svg.slice(next + 2, end).trim();
      if (stack.pop() !== name) {
        return { ok: false, error: "SVG je poškozené." };
      }
      if (name === "style") {
        inStyle = false;
      }
      position = end + 1;
      continue;
    }

    const tag = readTag(svg, next);
    if (!tag.ok) {
      return tag;
    }
    if (stack.length === 0) {
      if (tag.name !== "svg") {
        return { ok: false, error: "Soubor není SVG." };
      }
      rootAttributesAt = next + "<svg".length;
      rootHasNamespace = tag.hasNamespace;
    } else if (tag.name === "svg") {
      return {
        ok: false,
        error: "SVG obsahuje nepovolený prvek <svg>.",
      };
    }
    if (!tag.selfClosing) {
      stack.push(tag.name);
      inStyle = tag.name === "style";
    }
    position = tag.end;
  }

  if (stack.length > 0) {
    return { ok: false, error: "SVG je poškozené." };
  }
  if (rootAttributesAt === -1) {
    return { ok: false, error: "Soubor není SVG." };
  }
  // An SVG with no namespace does not render inside an `<img>` at all. The
  // insertion point is the one this parser just read, so adding it is safe.
  if (!rootHasNamespace) {
    return {
      ok: true,
      svg:
        svg.slice(0, rootAttributesAt) +
        ` xmlns="${SVG_NAMESPACE}"` +
        svg.slice(rootAttributesAt),
    };
  }
  return { ok: true, svg };
}

type TagRead =
  | { ok: true; name: string; end: number; selfClosing: boolean; hasNamespace: boolean }
  | { ok: false; error: string };

/** Read `<name attr="value" …>` from `start`, checking every part of it. */
function readTag(svg: string, start: number): TagRead {
  const nameMatch = /^<([A-Za-z][A-Za-z0-9:-]*)/.exec(svg.slice(start));
  if (!nameMatch) {
    return { ok: false, error: "SVG je poškozené." };
  }
  const name = nameMatch[1]!;
  if (!ALLOWED_ELEMENTS.has(name)) {
    return { ok: false, error: `SVG obsahuje nepovolený prvek <${name}>.` };
  }

  let position = start + nameMatch[0].length;
  let hasNamespace = false;

  for (;;) {
    while (position < svg.length && /\s/.test(svg[position]!)) {
      position += 1;
    }
    if (position >= svg.length) {
      return { ok: false, error: "SVG je poškozené." };
    }
    if (svg.startsWith("/>", position)) {
      return { ok: true, name, end: position + 2, selfClosing: true, hasNamespace };
    }
    if (svg[position] === ">") {
      return { ok: true, name, end: position + 1, selfClosing: false, hasNamespace };
    }

    const attribute = /^([A-Za-z_:][A-Za-z0-9_:.-]*)\s*=\s*("[^"]*"|'[^']*')/.exec(
      svg.slice(position),
    );
    if (!attribute) {
      return { ok: false, error: "SVG je poškozené." };
    }
    const attributeName = attribute[1]!;
    const value = attribute[2]!.slice(1, -1);

    const check = checkAttribute(attributeName, value);
    if (!check.ok) {
      return check;
    }
    if (attributeName === "xmlns") {
      hasNamespace = true;
    }
    position += attribute[0].length;
  }
}

type Check = { ok: true } | { ok: false; error: string };

function checkAttribute(name: string, value: string): Check {
  if (/^on/i.test(name)) {
    return { ok: false, error: `SVG obsahuje obslužný skript ${name}.` };
  }
  if (LOCAL_REFERENCE_ATTRIBUTES.has(name)) {
    return LOCAL_REFERENCE.test(value)
      ? { ok: true }
      : {
          ok: false,
          error: "SVG odkazuje mimo sebe. Povolené jsou jen odkazy uvnitř dokumentu.",
        };
  }
  if (
    !ALLOWED_ATTRIBUTES.has(name) &&
    !ALLOWED_ATTRIBUTE_PREFIXES.some((prefix) => name.startsWith(prefix))
  ) {
    return { ok: false, error: `SVG obsahuje nepovolený atribut ${name}.` };
  }
  if (name === "xmlns" && value !== SVG_NAMESPACE) {
    return { ok: false, error: "Soubor není SVG." };
  }
  const entities = checkEntities(value);
  if (!entities.ok) {
    return entities;
  }
  return checkValue(value);
}

/**
 * What a value may point at: a gradient or a clip path defined in the same
 * document, and nothing else. Everything a browser would fetch or run is
 * refused by this one rule, whatever attribute or stylesheet it was hiding in.
 */
function checkReferences(value: string): Check {
  const lowered = value.toLowerCase();
  if (lowered.includes("<")) {
    return { ok: false, error: "SVG je poškozené." };
  }
  if (
    lowered.includes("javascript:") ||
    lowered.includes("data:") ||
    lowered.includes("@import") ||
    lowered.includes("expression(")
  ) {
    return { ok: false, error: "SVG obsahuje skript nebo vložený obsah." };
  }
  for (const reference of lowered.matchAll(/url\(\s*['"]?([^)]*)/g)) {
    if (!reference[1]!.startsWith("#")) {
      return {
        ok: false,
        error: "SVG odkazuje mimo sebe. Povolené jsou jen odkazy uvnitř dokumentu.",
      };
    }
  }
  return { ok: true };
}

/** An attribute value, which this parser has already read whole and quoted. */
function checkValue(value: string): Check {
  if (value.includes(">")) {
    return { ok: false, error: "SVG je poškozené." };
  }
  return checkReferences(value);
}

/** Text between elements — a `<title>`, or the letters of a `<text>`. */
function checkText(text: string): Check {
  return checkEntities(text);
}

/**
 * The body of a `<style>` element. Held to the reference rule and nothing more:
 * `>` is a child combinator in CSS, and refusing a valid stylesheet as
 * "poškozené" would be a lie.
 */
function checkStyleSheet(css: string): Check {
  const entities = checkEntities(css);
  if (!entities.ok) {
    return entities;
  }
  return checkReferences(css);
}

/**
 * Only the five named entities. A numeric reference is where `javascript:`
 * hides from a check like the one above, and no exported icon contains one.
 */
function checkEntities(value: string): Check {
  let index = value.indexOf("&");
  while (index !== -1) {
    if (!ALLOWED_ENTITY.test(value.slice(index))) {
      return {
        ok: false,
        error: "SVG obsahuje zápis, který aplikace nepřečte (&#…).",
      };
    }
    index = value.indexOf("&", index + 1);
  }
  return { ok: true };
}
