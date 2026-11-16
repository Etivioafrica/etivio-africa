# 3 · Server logic

**Source of truth:** `src/app/api/`, `**/actions.ts`, `src/lib/data/`, `src/lib/*.ts`
**Runs on:** Vercel Node functions

There is no separate API server. Logic lives in three places:

1. **Server Components** fetch page data through `src/lib/data/*`, one module per domain: access, admin, badges, blog, campus, certificates, charts, checkout, coaching, communities, coupons, courses-admin, dashboard, features, grants, group-buy, guest, guide, learn, marketplace, messages, product-form, products-admin, profile, projects, public-profile.
2. **Server Actions** in `actions.ts` files beside each route handle form posts and mutations (for example `src/app/(app)/teach/actions.ts` and `ai-actions.ts`).
3. **Route handlers** under `src/app/api` cover everything that has to be a plain URL.

## Route handlers

| Route | Called by | Purpose |
|-------|-----------|---------|
| `POST /api/upload/sign` | Browser | 15-minute presigned R2 PUT URL under `incoming/<user>/` |
| `POST /api/upload/finish` | Browser | Sniffs real file type, screens images, cleans with sharp, moves the file to its folder (`maxDuration` 60 s) |
| `GET /api/download/[fileId]` | Buyer | Checks ownership, logs the download, redirects to a 5-minute signed R2 link |
| `GET /api/paystack/callback` | Paystack redirect | Buyer returns from checkout; verify, then fulfil |
| `POST /api/paystack/webhook` | Paystack servers | HMAC-checked `charge.success`; re-verify, then fulfil |
| `GET /api/cron/checkout-reminders` | pg_cron, every 10 min | Abandoned-checkout reminder emails |
| `GET /api/cron/coach-reminders` | pg_cron, every 10 min | Coaching session reminders, an hour before |
| `POST /api/ai/assistant` | Browser | Etivio AI assistant chat (streams) |
| `POST /api/ai/lesson` | Browser | Ask AI inside a lesson (streams) |
| `POST /api/ai/demo` | Browser | Public AI demo |
| `POST /api/t` | `VisitTracker` | First-party visit analytics |
| `/api/blog/comments`, `/likes`, `/views` | Browser | Blog engagement |
| `GET /api/export` | Signed-in user | "Export your data" (HTML or JSON), runs as the user under RLS |

## Shared server modules (`src/lib`)

| Area | Modules |
|------|---------|
| Access and identity | `auth.ts`, `roles.ts`, `owner.ts`, `access.ts`, `username.ts`, `my-profile.ts`, `profile-limits.ts` |
| Commerce | `paystack.ts`, `cart.ts`, `payouts.ts`, `banks.ts`, `referral.ts`, `marketplace.ts` |
| Content | `blog.ts`, `blog-server.ts`, `course-status.ts`, `course-tiles.ts`, `player.ts`, `video.ts`, `help.ts`, `guide.ts`, `announcements.ts` |
| Files | `r2.ts`, `upload-server.ts`, `upload-safety.ts`, `upload-client.ts`, `image-crop.ts`, `avatars.ts` |
| AI and safety | `ai.ts`, `ai-writer.ts`, `moderation.ts`, `sanitize.ts`, `field-limits.ts` |
| Platform | `features.ts`, `platform.ts`, `activity.ts`, `charts-metrics.ts`, `seo.tsx`, `theme.ts`, `format.ts`, `link-meta.ts`, `ice.ts`, `coach-time.ts`, `learner-prefs.ts`, `skills.ts`, `badges.ts` |

`server-only` guards modules that hold secrets (`r2.ts`, `ai.ts`, `ice.ts`, `supabase/admin.ts`) so they can't be bundled into client code.
