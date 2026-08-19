import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Presence: the last visit and the last activity of a person, shown to their
 * colleagues (the members list, `/tym`).
 *
 * Two timestamps on one `userPresence` row per user:
 *
 * - `lastSeenAt`   — the last heartbeat. The app shell sends one on mount, on
 *                    every return to a visible tab and every `HEARTBEAT_MS`
 *                    while visible. "Online" is a *client-side* reading of it
 *                    (`isOnline`), because a query cannot tick.
 * - `lastActiveAt` — the last write that counts as work: a task created, moved,
 *                    renamed or assigned, a body saved, a file added, a comment,
 *                    a reaction. Being active also counts as being seen.
 *
 * Both writes are throttled by `WRITE_GAP_MS`: a row fresher than that is left
 * alone, which turns a heartbeat storm or a 1 s autosave into at most one write
 * a minute — and every subscriber of the members list re-runs only that often.
 * `Date.now()` is read on the server, never taken from the client; clocks
 * disagree.
 */

/** How often a visible tab sends a heartbeat. */
export const HEARTBEAT_MS = 60_000;

/** A row fresher than this is not rewritten. Below `HEARTBEAT_MS` on purpose. */
export const WRITE_GAP_MS = 45_000;

/**
 * Seen within this window counts as "Online". Three heartbeats, so one missed
 * (a laptop lid closed for a moment) does not flicker the dot off.
 */
export const ONLINE_WINDOW_MS = 3 * 60_000;

export type Presence = {
  /** `null` when the person has never been seen since the feature shipped. */
  lastSeenAt: number | null;
  lastActiveAt: number | null;
};

export const EMPTY_PRESENCE: Presence = { lastSeenAt: null, lastActiveAt: null };

/** Pure: shared with the client through `src/lib/presence.ts`. */
export function isOnline(lastSeenAt: number | null, now: number): boolean {
  return lastSeenAt !== null && now - lastSeenAt < ONLINE_WINDOW_MS;
}

export async function getPresenceRow(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"userPresence"> | null> {
  return ctx.db
    .query("userPresence")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

/** The two timestamps for one person, `EMPTY_PRESENCE` when there is no row. */
export async function getPresence(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Presence> {
  const row = await getPresenceRow(ctx, userId);
  return row
    ? { lastSeenAt: row.lastSeenAt, lastActiveAt: row.lastActiveAt ?? null }
    : EMPTY_PRESENCE;
}

/**
 * Record a visit. Skips the write when the row was updated less than
 * `WRITE_GAP_MS` ago; returns whether anything was written.
 */
export async function touchSeen(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const now = Date.now();
  const row = await getPresenceRow(ctx, userId);
  if (!row) {
    await ctx.db.insert("userPresence", { userId, lastSeenAt: now });
    return true;
  }
  if (now - row.lastSeenAt < WRITE_GAP_MS) {
    return false;
  }
  await ctx.db.patch(row._id, { lastSeenAt: now });
  return true;
}

/**
 * Record work. Sets `lastActiveAt` and, since working means being here,
 * `lastSeenAt` too. Throttled like `touchSeen`, on `lastActiveAt`. Call it from
 * a mutation **after** authorization has passed — an unauthorized attempt is
 * not activity. Never throws, so a presence hiccup can never fail the work.
 */
export async function touchActive(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const now = Date.now();
  const row = await getPresenceRow(ctx, userId);
  if (!row) {
    await ctx.db.insert("userPresence", {
      userId,
      lastSeenAt: now,
      lastActiveAt: now,
    });
    return true;
  }
  if (row.lastActiveAt !== undefined && now - row.lastActiveAt < WRITE_GAP_MS) {
    return false;
  }
  await ctx.db.patch(row._id, { lastSeenAt: now, lastActiveAt: now });
  return true;
}

/** Called when the user is deleted; the row has nobody to describe. */
export async function deletePresence(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const row = await getPresenceRow(ctx, userId);
  if (row) {
    await ctx.db.delete(row._id);
  }
}
