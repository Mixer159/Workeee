/**
 * Initials for an avatar fallback. Falls back to the e-mail when the name is
 * empty. Always returns at most two characters, uppercase.
 */
export function userInitials(name?: string | null, email?: string | null): string {
  const source = (name ?? "").trim() || (email ?? "").trim();
  if (!source) {
    return "?";
  }
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
