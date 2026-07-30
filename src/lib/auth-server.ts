import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

/**
 * Server-side helpers for authenticated SSR, server actions and route handlers.
 * `handler` backs the /api/auth/[...all] proxy into the Convex deployment.
 */
export const {
  handler,
  preloadAuthQuery,
  isAuthenticated,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthNextJs({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
});
