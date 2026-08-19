import { isOnline, type Presence } from "@convex/lib/presence";
import { formatRelativeTime } from "@/lib/format";

/**
 * The two timestamps turned into the two short sentences a colleague reads.
 *
 * "Online" is decided here rather than on the server, because a query cannot
 * tick: the row says when somebody was last seen, and whether that still counts
 * depends on the clock the reader is watching. `now` therefore comes from
 * `useNow()`, never from a `Date.now()` during render.
 *
 * Every label is verbless — Czech past tense is gendered and the app does not
 * know anybody's gender.
 */
export type PresenceDescription = {
  online: boolean;
  /** "Online" · "Naposledy online před 5 min" · "Zatím bez návštěvy" */
  seen: string;
  /** "Aktivita před 2 hodinami" · "Bez aktivity" */
  active: string;
};

export function describePresence(
  presence: Presence,
  now: number,
): PresenceDescription {
  const { lastSeenAt, lastActiveAt } = presence;
  const online = isOnline(lastSeenAt, now);

  let seen: string;
  if (online) {
    seen = "Online";
  } else if (lastSeenAt === null) {
    seen = "Zatím bez návštěvy";
  } else {
    seen = `Naposledy online ${formatRelativeTime(lastSeenAt, now)}`;
  }

  const active =
    lastActiveAt === null
      ? "Bez aktivity"
      : `Aktivita ${formatRelativeTime(lastActiveAt, now)}`;

  return { online, seen, active };
}
