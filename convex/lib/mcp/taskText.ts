/**
 * A task body as plain text, for a bot to read.
 *
 * The body is a BlockNote document (already validated by `../taskContent.ts`
 * on the way in); a language model needs its words, not its JSON. One line
 * per block, nested blocks indented by two spaces, links reduced to their
 * text. Anything unrecognised contributes nothing rather than failing — the
 * description is context for the bot, not something it can repair.
 */

/** A bot reads the description as context; past this it is noise. */
export const MAX_TASK_TEXT_LENGTH = 20_000;

export function taskContentText(blocks: unknown[]): string {
  const lines: string[] = [];
  collectBlocks(blocks, 0, lines);
  const text = lines.join("\n").trim();
  if (text.length <= MAX_TASK_TEXT_LENGTH) {
    return text;
  }
  return `${text.slice(0, MAX_TASK_TEXT_LENGTH - 1).trimEnd()}…`;
}

function collectBlocks(blocks: unknown[], depth: number, lines: string[]) {
  for (const block of blocks) {
    if (!isRecord(block)) {
      continue;
    }
    const text = inlineText(block.content);
    if (text.length > 0) {
      lines.push(`${"  ".repeat(depth)}${text}`);
    }
    if (Array.isArray(block.children)) {
      collectBlocks(block.children, depth + 1, lines);
    }
  }
}

function inlineText(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((item) => {
      if (!isRecord(item)) {
        return "";
      }
      if (typeof item.text === "string") {
        return item.text;
      }
      // A link carries its own inline content.
      return inlineText(item.content);
    })
    .join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
