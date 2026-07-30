export const MAX_NAME_LENGTH = 60;

/** A task title is a sentence, not a label — it gets a longer bound. */
export const MAX_TITLE_LENGTH = 200;

/** Trim and bound a person's display name before it enters the app mirror. */
export function normalizeUserName(value: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length === 0) {
    throw new Error("Zadejte jméno.");
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`Jméno může mít nejvýš ${MAX_NAME_LENGTH} znaků.`);
  }
  return name;
}

/**
 * Trim and bound a user-supplied display name. Mutations only — the client's
 * `maxLength` is cosmetic.
 */
export function normalizeName(value: string, subject: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length === 0) {
    throw new Error(`Zadejte název ${subject}.`);
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`Název ${subject} může mít nejvýš ${MAX_NAME_LENGTH} znaků.`);
  }
  return name;
}

/**
 * Does what a person typed match a name they are being asked to confirm?
 *
 * Imported by **both** sides: the delete-organization dialog enables its button
 * with it, `organizations.remove` re-checks with it. One rule, so the button can
 * never be enabled for a value the mutation will refuse. Case and extra spaces
 * are forgiven — the point of typing the name is deliberation, not dictation.
 */
export function isSameName(typed: string, name: string): boolean {
  const normalized = normalizeForComparison(typed);
  return normalized.length > 0 && normalized === normalizeForComparison(name);
}

function normalizeForComparison(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("cs");
}

/**
 * An emoji used as a project icon.
 *
 * The client picks from a curated grid, but the mutation cannot trust that, and
 * duplicating the grid on the server would only guarantee the two lists drift.
 * The rule is therefore structural: what arrives must be *emoji* — at least one
 * pictographic character, and nothing but pictographs, modifiers, joiners and
 * variation selectors. That keeps a name, a URL or a script tag out of a field
 * every screen renders.
 */
const EMOJI_PATTERN =
  /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\u200D\uFE0F]+$/u;

/** A ZWJ sequence with skin tones is a handful of code points, never more. */
export const MAX_EMOJI_LENGTH = 16;

export function normalizeEmoji(value: string): string {
  const emoji = value.trim();
  if (emoji.length === 0) {
    throw new Error("Vyberte ikonu.");
  }
  if (
    emoji.length > MAX_EMOJI_LENGTH ||
    !EMOJI_PATTERN.test(emoji) ||
    !/\p{Extended_Pictographic}/u.test(emoji)
  ) {
    throw new Error("Ikona musí být emoji.");
  }
  return emoji;
}

/** Trim and bound a task title. Mutations only. */
export function normalizeTitle(value: string): string {
  const title = value.trim().replace(/\s+/g, " ");
  if (title.length === 0) {
    throw new Error("Zadejte název úkolu.");
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new Error(`Název úkolu může mít nejvýš ${MAX_TITLE_LENGTH} znaků.`);
  }
  return title;
}
