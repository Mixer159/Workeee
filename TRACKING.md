# TRACKING.md Workeee

Last audit: 2026-10-19 (legal pass on the public page from PR #3; no audit file) · Skill: marketing-stack-skill
Live: app https://workeee.vercel.app (public page `/o-aplikaci`, also served on `/` without a session, and `/zmeny`) · Repo: this one · Deployments: Vercel (app, workeee.vercel.app), Convex `incredible-cobra-806` (dev) / `rightful-barracuda-439` (prod)
Roles: accounts owner Maxim Kudela · marketing N/A · dev Maxim Kudela
Counterpart record: none

## Platforms in scope
| Platform | Status | Note |
|---|---|---|
| Google Ads | not used | |
| Meta | not used | |
| Sklik | not used | |
| GA4 | not used | |
| Clarity | not used | |

## Summary (one line per domain: OK / WARN / FAIL / N/A, verified on date)
- Analytics (GA4/GTM): N/A (2026-10-19) no analytics in the app or on the public page
- Consent/CMP: N/A (2026-10-19) nothing non-essential is stored: the app keeps the Better Auth session cookie and preferences the user chose (theme, organization, rail width) in browser storage; the public page itself stores nothing
- Legal pages: WARN (2026-10-19) no privacy notice for the app, which holds accounts (name, e-mail), presence timestamps and sends e-mail through Brevo
- Google ads / Meta / Clarity: N/A
- Google ecosystem: WARN (2026-10-19) no `robots.txt` or `sitemap.xml`; `/o-aplikaci` sets its canonical, resolved against `NEXT_PUBLIC_SITE_URL`
- CRM loop: N/A

## Identifiers (each row: verified on)
N/A. No tracking identifiers exist.

## Connected systems
| Link | Direction | Transport / endpoint | Auth (env name) | Contract | Health check | Owner | Verified |
|---|---|---|---|---|---|---|---|
| Convex → Brevo transactional e-mail | out | Brevo API from `convex/lib/brevo.ts` | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` (Convex env, optional) | CLAUDE.md "Upozornění" | digest or reset mail arrives | dev | 2026-10-19 (code read only) |
| Public page → GitHub, logo companies | out | plain links, new tab | none | `src/lib/landing.ts` `LINKS`, `src/components/marketing/logos.tsx` | link opens | dev | 2026-10-19 |

## Where things live in code
- Public page small print (copyright, design credit, painting credit): `src/lib/landing.ts` `CREDITS`, rendered in `src/components/marketing/footer.tsx`
- Painting sources (Wikimedia Commons, public domain): `src/lib/paintings.ts`
- Customer logos and their basis: `src/components/marketing/logos.tsx` (owner confirmed use and consent on 2026-10-19)
- Licence: `LICENSE` (MIT, "Maxim Kudela and contributors"); linked from both public pages
- Fonts: all self-hosted from `src/app/fonts` through `next/font/local` (Urbanist with its OFL licence), so no page requests a font CDN

## Events (taxonomy)
N/A

## Environment state (names only, checked 2026-10-19)
| Env var | dev | prod | Purpose |
|---|---|---|---|
| NEXT_PUBLIC_SITE_URL (Vercel) | `http://localhost:3000` | `https://workeee.vercel.app` | canonical and link previews of the public page, invite links |

## Access map
N/A

## Safe test procedure
N/A. Nothing is sent to an ad or analytics platform.

## Consent registry snapshot
N/A. No consent categories.

## Open findings
| id | Sev | Title | Owner | Since |
|---|---|---|---|---|
| legal-01 | S2 | The app has no privacy notice (GDPR čl. 13): controller, purposes, Convex/Vercel/Brevo as processors, retention, rights | Maxim | 2026-10-19 |

## History
- 2026-10-19 Record created during the merge of PR #3 (website in `web/`). Added the footer small print, the painting sources, the "Workeee používají" heading on the logo band after the owner confirmed use and consent, and "and contributors" in `LICENSE`. Verified by reading the code: no cookies, storage or third-party scripts in `web/`.
- 2026-10-19 The page left `web/` and became `/o-aplikaci` and `/zmeny` inside the app: one deployment, fonts self-hosted, links and changelog read from the app. The `web/` project with its `robots.txt` and `sitemap.xml` was dropped.
