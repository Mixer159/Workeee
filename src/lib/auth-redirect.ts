/**
 * Where to go once Better Auth has accepted a sign-in or a sign-up, and why it
 * is a document navigation rather than a `router.push`.
 *
 * The session cookie exists the moment the auth call resolves, but Convex does
 * not: `ConvexBetterAuthProvider` still has to exchange it for a token, and
 * until it does `useConvexAuth()` reports "not authenticated with nothing left
 * to load" — which is exactly the state `AuthGuard` answers by sending the
 * person to the sign-in screen. A client-side push lands inside that window and
 * bounces a brand new account straight back to `/prihlaseni`, which is the
 * first thing a new person sees.
 *
 * A full load has no window: the cookie is already on the request, so the app
 * boots authenticated. One extra navigation right after signing up is a price
 * worth paying for a first run that works every time.
 */
export function goAfterAuth(inviteCode?: string): void {
  window.location.assign(
    inviteCode ? `/join/${encodeURIComponent(inviteCode)}` : "/",
  );
}
