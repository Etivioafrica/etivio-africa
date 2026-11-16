# 12 · PWA, analytics, SEO

**Source of truth:** `public/app-sw.js`, `public/sw.js`, `public/sw-push.js`, `public/manifest.webmanifest`, `src/components/pwa`, `src/components/analytics/VisitTracker.tsx`, `src/app/api/t/route.ts`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/opengraph-image.tsx`, `src/lib/seo.tsx`

## Installable app

- `manifest.webmanifest` together with `app-sw.js` makes Etivio installable.
- `app-sw.js` (cache `etivio-app-v1`) caches only the app shell: the `/offline` page, the manifest, icons and onboarding images.
- Pages and data always come from the network, so courses, progress and payments are never served stale.

## Old PWA kill switch

`sw.js` and `sw-push.js` replace the service worker from the previous Lovable-built app. They delete the old caches, unregister themselves and reload open tabs onto the new site. They are served with `no-store` headers (see [01-edge-routing.md](01-edge-routing.md)). Keep these files until old installs have died out.

## First-party analytics

- `VisitTracker` posts to `/api/t` on every page change.
- Cookies: `et_vid` identifies the browser (1 year); `et_sid` identifies the visit (30 minutes from the last page).
- The server works out the channel (Paid, Email, App, Social, Search, Campaign, Referral, Direct), device, browser and OS, then reads country and city from Vercel's `x-vercel-ip-*` headers. It records the hit with the `track_visit()` RPC.
- Bots, cross-origin posts and **all non-production hits** are dropped.
- Reports appear in **Admin → Tracking**. Visits are pruned after 13 months and page views after 90 days.
- Blog views use `/api/blog/views`, also with Vercel geo headers.

## SEO

- `sitemap.ts` lists public pages.
- `robots.ts` blocks AI scrapers and SEO tool bots, and stops crawlers looping through `/explore` filter combinations.
- `opengraph-image.tsx` generates the default share image; `src/lib/seo.tsx` builds per-page metadata.
- The proxy's 308 from `www` to the apex keeps one canonical host.
