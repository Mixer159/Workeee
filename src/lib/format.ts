import { plural } from "@convex/lib/plural";

const dateTimeFormat = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

/**
 * The two formatters the changelog uses. They are pinned to UTC on purpose: a
 * changelog date is a calendar day, not a moment, and `new Date("2026-08-10")`
 * is midnight UTC — read in a timezone behind Greenwich it would print the
 * ninth.
 */
const isoDateFormat = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const isoMonthFormat = new Intl.DateTimeFormat("cs-CZ", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDateTime(timestamp: number): string {
  return dateTimeFormat.format(timestamp);
}

export function formatDate(timestamp: number): string {
  return dateFormat.format(timestamp);
}

/** `"2026-08-10"` → `"10. 8. 2026"`. */
export function formatIsoDate(iso: string): string {
  return isoDateFormat.format(new Date(`${iso}T00:00:00Z`));
}

/** `"2026-08"` or `"2026-08-10"` → `"srpen 2026"`. */
export function formatIsoMonth(iso: string): string {
  return isoMonthFormat.format(new Date(`${iso.slice(0, 7)}-01T00:00:00Z`));
}

/**
 * "vyprší 6. 8. 2026 14:30" / "vypršela 1. 8. 2026".
 *
 * Whether the invite is expired is decided by the server, not by a `Date.now()`
 * read during render — that would be an impure render under React Compiler and
 * would disagree with the status badge next to it.
 */
export function formatExpiry(expiresAt: number, expired: boolean): string {
  if (expired) {
    return `vypršela ${formatDate(expiresAt)}`;
  }
  return `vyprší ${formatDateTime(expiresAt)}`;
}

/** "12 kB" / "3,4 MB". Sizes are decimal, the way an operating system shows them. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1000) {
    return `${bytes} B`;
  }
  if (bytes < 1000 * 1000) {
    return `${Math.round(bytes / 1000)} kB`;
  }
  const megabytes = bytes / (1000 * 1000);
  return `${megabytes.toFixed(megabytes < 10 ? 1 : 0).replace(".", ",")} MB`;
}

/**
 * "před 5 min" for a comment in the stream.
 *
 * `now` is a parameter, never a `Date.now()` read during render — that is an
 * impure render under the React Compiler and it would also disagree with the
 * timestamp next to it. Components take `now` from `useNow()`, which ticks
 * through `useSyncExternalStore`.
 */
export function formatRelativeTime(timestamp: number, now: number): string {
  const seconds = Math.round((now - timestamp) / 1000);
  if (seconds < 0) {
    return "právě teď";
  }
  if (seconds < 60) {
    return "právě teď";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `před ${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `před ${hours} ${plural(hours, "hodinou", "hodinami", "hodinami")}`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `před ${days} ${plural(days, "dnem", "dny", "dny")}`;
  }
  return formatDateTime(timestamp);
}
