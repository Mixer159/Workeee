/**
 * Client-side invite vocabulary. The expiry presets mirror
 * `convex/lib/invites.ts`; the server maps them to a date, the client only
 * labels them.
 */
export type InviteExpiryPreset = "6h" | "24h" | "48h" | "7d" | "30d";

export const INVITE_EXPIRY_OPTIONS: {
  value: InviteExpiryPreset;
  label: string;
}[] = [
  { value: "6h", label: "6 hodin" },
  { value: "24h", label: "24 hodin" },
  { value: "48h", label: "48 hodin" },
  { value: "7d", label: "7 dní" },
  { value: "30d", label: "30 dní" },
];

export const DEFAULT_INVITE_EXPIRY: InviteExpiryPreset = "7d";

export type InviteStatus = "active" | "expired" | "revoked" | "used";

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  active: "Aktivní",
  expired: "Vypršela",
  revoked: "Zrušena",
  used: "Použita",
};

/** Alpha convention, so both themes work without a second definition. */
export const INVITE_STATUS_BADGE: Record<InviteStatus, string> = {
  active:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  expired: "border-border bg-muted text-muted-foreground",
  revoked: "border-destructive/20 bg-destructive/10 text-destructive",
  used: "border-border bg-muted text-muted-foreground",
};

/**
 * The link people actually paste into chat. `NEXT_PUBLIC_SITE_URL` is the
 * deployment's public origin; in the browser we fall back to the current one so
 * a misconfigured env never produces a link to the wrong host.
 */
export function inviteLink(code: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const origin =
    configured ??
    (typeof window === "undefined" ? "" : window.location.origin);
  return `${origin.replace(/\/$/, "")}/join/${code}`;
}
