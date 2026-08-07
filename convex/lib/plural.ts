/**
 * Czech needs three forms: 1 / 2–4 / 5+. Every count rendered next to a noun
 * goes through here rather than through `${n} položek`.
 *
 * It lives in `convex/` rather than in `src/lib/format.ts` because the server
 * needs it too — the subject line of a notification e-mail is built inside a
 * Convex function (`convex/lib/notificationEmail.ts`), and a second copy of the
 * rule would be a second thing to keep right. Shared code in this repo lives on
 * the Convex side and the client imports it from there, the same way
 * `convex/lib/commentBody.ts` is shared with the comment composer.
 */
export function plural(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const absolute = Math.abs(count);
  if (absolute === 1) {
    return one;
  }
  if (absolute >= 2 && absolute <= 4) {
    return few;
  }
  return many;
}
