/**
 * The address the site is served from, for canonical links, the sitemap,
 * robots.txt and link previews. The production domain is not decided yet,
 * so it is never written down here:
 *
 * 1. NEXT_PUBLIC_SITE_URL, once the domain is known (e.g. https://example.cz);
 * 2. on Vercel, the project's production domain, which Vercel exposes to the
 *    build as VERCEL_PROJECT_PRODUCTION_URL (its shortest custom domain, or
 *    the vercel.app one), so previews also point search engines there;
 * 3. otherwise the local dev server.
 */
function resolveSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3210";
}

export const SITE_URL = new URL(resolveSiteUrl());

/** An absolute address on this site, for the sitemap and robots.txt. */
export const absolute = (path: string) => new URL(path, SITE_URL).toString();
