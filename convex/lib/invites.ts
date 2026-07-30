import type { Infer } from "convex/values";
import type { inviteExpiryPresets } from "../schema";

export type InviteExpiryPreset = Infer<typeof inviteExpiryPresets>;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** The only lifetimes an invite can have. The client sends a preset, never a date. */
export const INVITE_EXPIRY_MS: Record<InviteExpiryPreset, number> = {
  "6h": 6 * HOUR,
  "24h": 24 * HOUR,
  "48h": 48 * HOUR,
  "7d": 7 * DAY,
  "30d": 30 * DAY,
};

export function expiresAtFromPreset(
  preset: InviteExpiryPreset,
  now: number,
): number {
  return now + INVITE_EXPIRY_MS[preset];
}

/**
 * Unambiguous alphabet: no `0`/`O`, no `1`/`I`/`L`. 31 symbols, so a 10-symbol
 * code carries ~49 bits — enough that guessing one is not a strategy.
 */
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 10;

/**
 * CSPRNG code with rejection sampling — `% alphabet.length` on a raw byte would
 * bias the first symbols of the alphabet.
 */
export function generateInviteCode(): string {
  const size = INVITE_CODE_ALPHABET.length;
  const limit = 256 - (256 % size);
  let code = "";
  while (code.length < INVITE_CODE_LENGTH) {
    const bytes = new Uint8Array(INVITE_CODE_LENGTH);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= limit) {
        continue;
      }
      code += INVITE_CODE_ALPHABET[byte % size];
      if (code.length === INVITE_CODE_LENGTH) {
        break;
      }
    }
  }
  return code;
}

export type InviteStatus = "active" | "expired" | "revoked" | "used";

export function inviteStatus(
  invite: {
    expiresAt: number;
    revoked?: boolean;
    usedCount: number;
    acceptedBy?: unknown;
  },
  now: number,
): InviteStatus {
  if (invite.revoked) {
    return "revoked";
  }
  if (invite.acceptedBy !== undefined || invite.usedCount > 0) {
    return "used";
  }
  if (invite.expiresAt <= now) {
    return "expired";
  }
  return "active";
}
