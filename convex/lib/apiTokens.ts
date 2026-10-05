import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Personal API tokens — the credential a bot connects to the MCP endpoint with.
 *
 * A token is `wrk_` plus 32 random bytes in base64url (256 bits). Only its
 * SHA-256 is stored, so the secret exists in exactly two places: the dialog
 * that showed it once, and the MCP client it was pasted into. A plain hash and
 * no salt is the right tool here, unlike for a password: the input is already
 * uniformly random and long, so there is nothing for a dictionary to guess, and
 * an unsalted digest is what lets the lookup be one indexed read.
 *
 * Hashing is `crypto.subtle`, which is async, so it only ever runs in an
 * action or an HTTP action and the hex digest is what crosses into a
 * transaction.
 */

export const API_TOKEN_PREFIX = "wrk_";

const SECRET_BYTES = 32;

/** How much of the token the list shows — enough to tell two tokens apart. */
const DISPLAY_PREFIX_LENGTH = API_TOKEN_PREFIX.length + 6;

/** A person with more live tokens than this is not managing them. */
export const MAX_ACTIVE_TOKENS = 20;

/**
 * `lastUsedAt` is a hint for the list, not an audit trail: an agent calling
 * tools in a loop must not rewrite the row on every call.
 */
export const LAST_USED_GAP_MS = 60_000;

export function generateApiToken(): string {
  const bytes = new Uint8Array(SECRET_BYTES);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64url = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${API_TOKEN_PREFIX}${base64url}`;
}

export function apiTokenDisplayPrefix(token: string): string {
  return token.slice(0, DISPLAY_PREFIX_LENGTH);
}

/** SHA-256 of the whole token, lower-case hex. Actions and HTTP actions only. */
export async function hashApiToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * The token from an `Authorization: Bearer …` header, or null. Anything that
 * does not look like one of ours is refused here, before it costs a hash and
 * a database read.
 */
export function parseBearerToken(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (!match) {
    return null;
  }
  const token = match[1];
  if (!token.startsWith(API_TOKEN_PREFIX) || token.length > 128) {
    return null;
  }
  return token;
}

/** A live token by its hash, or null for an unknown or revoked one. */
export async function getActiveApiToken(
  ctx: QueryCtx | MutationCtx,
  tokenHash: string,
): Promise<Doc<"apiTokens"> | null> {
  const token = await ctx.db
    .query("apiTokens")
    .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!token || token.revokedAt !== undefined) {
    return null;
  }
  return token;
}
