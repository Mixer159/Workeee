/**
 * The structural envelope accepted by the default BlockNote schema.
 *
 * This module deliberately has no browser or Convex runtime dependencies so
 * the mutation and the task drawer can enforce the same boundary. It is not a
 * replacement for BlockNote's schema; it rejects shapes that its JSON-to-node
 * conversion cannot safely consume and bounds recursive work.
 */

export const MAX_TASK_CONTENT_BYTES = 1024 * 1024;
export const MAX_TASK_CONTENT_DEPTH = 50;
export const MAX_TASK_CONTENT_NODES = 20_000;

const INLINE_BLOCKS = new Set([
  "bulletListItem",
  "checkListItem",
  "heading",
  "numberedListItem",
  "paragraph",
  "quote",
  "toggleListItem",
]);
const FILE_BLOCKS = new Set(["audio", "file", "image", "video"]);
const SUPPORTED_BLOCKS = new Set([
  ...INLINE_BLOCKS,
  ...FILE_BLOCKS,
  "codeBlock",
  "divider",
  "table",
]);

type JsonRecord = Record<string, unknown>;
type ValidationState = { nodes: number };

/** Parse a stored document only when the default BlockNote editor can consume it. */
export function parseTaskContent(raw: string): unknown[] | null {
  if (raw.length > MAX_TASK_CONTENT_BYTES) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) {
    return null;
  }

  const state: ValidationState = { nodes: 0 };
  return parsed.every((block) => isBlock(block, 0, state)) ? parsed : null;
}

function consumeNode(state: ValidationState) {
  state.nodes += 1;
  return state.nodes <= MAX_TASK_CONTENT_NODES;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBlock(value: unknown, depth: number, state: ValidationState): boolean {
  if (
    depth > MAX_TASK_CONTENT_DEPTH ||
    !consumeNode(state) ||
    !isRecord(value)
  ) {
    return false;
  }
  if (value.id !== undefined && typeof value.id !== "string") {
    return false;
  }
  if (value.props !== undefined && !isProps(value.props)) {
    return false;
  }

  const type = value.type ?? "paragraph";
  if (typeof type !== "string" || !SUPPORTED_BLOCKS.has(type)) {
    return false;
  }
  if (
    value.children !== undefined &&
    (!Array.isArray(value.children) ||
      !value.children.every((child) => isBlock(child, depth + 1, state)))
  ) {
    return false;
  }

  const content = value.content;
  if (content === undefined || content === null) {
    return true;
  }
  if (INLINE_BLOCKS.has(type)) {
    return isInlineContent(content, state);
  }
  if (type === "codeBlock") {
    return isPlainContent(content, state);
  }
  if (type === "table") {
    return isTableContent(content, state);
  }
  // BlockNote serializes content-less blocks without a `content` property.
  // An empty array is accepted for compatibility with its HTML parser output.
  return (
    (FILE_BLOCKS.has(type) || type === "divider") &&
    Array.isArray(content) &&
    content.length === 0
  );
}

function isProps(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).every(
    (prop) =>
      typeof prop === "string" ||
      typeof prop === "boolean" ||
      (typeof prop === "number" && Number.isFinite(prop)) ||
      prop === null,
  );
}

function isInlineContent(value: unknown, state: ValidationState): boolean {
  if (typeof value === "string") {
    return true;
  }
  return (
    Array.isArray(value) &&
    value.every((item) => isInlineContentItem(item, state))
  );
}

function isInlineContentItem(value: unknown, state: ValidationState): boolean {
  if (!consumeNode(state)) {
    return false;
  }
  if (typeof value === "string") {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }
  if (value.type === "text") {
    return (
      typeof value.text === "string" &&
      (value.styles === undefined || isStyles(value.styles))
    );
  }
  if (value.type === "link") {
    return (
      typeof value.href === "string" &&
      (typeof value.content === "string" ||
        (Array.isArray(value.content) &&
          value.content.every((item) => isStyledText(item, state))))
    );
  }
  return false;
}

function isStyledText(value: unknown, state: ValidationState): boolean {
  return (
    consumeNode(state) &&
    isRecord(value) &&
    value.type === "text" &&
    typeof value.text === "string" &&
    (value.styles === undefined || isStyles(value.styles))
  );
}

function isStyles(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return Object.entries(value).every(([style, setting]) => {
    if (["bold", "code", "italic", "strike", "underline"].includes(style)) {
      return typeof setting === "boolean";
    }
    if (["backgroundColor", "textColor"].includes(style)) {
      return typeof setting === "string";
    }
    return false;
  });
}

function isPlainContent(value: unknown, state: ValidationState): boolean {
  if (typeof value === "string") {
    return true;
  }
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every((item) => {
    if (typeof item === "string") {
      return consumeNode(state);
    }
    return isStyledText(item, state);
  });
}

function isTableContent(value: unknown, state: ValidationState): boolean {
  if (
    !isRecord(value) ||
    value.type !== "tableContent" ||
    !Array.isArray(value.rows) ||
    value.rows.length === 0
  ) {
    return false;
  }
  if (
    value.columnWidths !== undefined &&
    (!Array.isArray(value.columnWidths) ||
      !value.columnWidths.every(
        (width) =>
          width === null ||
          (typeof width === "number" && Number.isFinite(width) && width >= 0),
      ))
  ) {
    return false;
  }

  const rows = value.rows;
  let columnCount: number | null = null;
  for (const row of rows) {
    if (!consumeNode(state) || !isRecord(row) || !Array.isArray(row.cells)) {
      return false;
    }
    if (row.cells.length === 0) {
      return false;
    }
    columnCount ??= row.cells.length;
    if (
      row.cells.length !== columnCount ||
      !row.cells.every((cell) => isTableCell(cell, state))
    ) {
      return false;
    }
  }

  return (
    isOptionalTableHeader(value.headerRows, rows.length) &&
    isOptionalTableHeader(value.headerCols, columnCount ?? 0)
  );
}

function isOptionalTableHeader(value: unknown, maximum: number): boolean {
  return (
    value === undefined ||
    (typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= maximum)
  );
}

function isTableCell(value: unknown, state: ValidationState): boolean {
  if (!consumeNode(state)) {
    return false;
  }
  if (typeof value === "string") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((item) => isInlineContentItem(item, state));
  }
  if (!isRecord(value) || value.type !== "tableCell") {
    return false;
  }
  return (
    (value.props === undefined || isProps(value.props)) &&
    (value.content === undefined || isInlineContent(value.content, state))
  );
}
