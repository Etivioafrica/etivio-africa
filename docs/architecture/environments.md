# Environments & configuration

**Source of truth:** `.env.example`, `package.json`, `vercel.json`, `README.md`

## Environments

| Environment | Where | Notes |
|-------------|-------|-------|
| Production | `https://etivio.co`, Vercel `dub1` | Env vars set in Vercel project settings. Cron and webhook URLs are hard-coded to `etivio.co` |
| Preview | Vercel preview deployment per branch or PR | Uses env vars scoped to Preview in Vercel |
| Local | `npm run dev` → `http://localhost:3010` | Reads `.env.local` (copied from `.env.example`). Turbopack dev server |

> **Warning: local development points at the live database.** No separate dev Supabase project is set up in the repo, and `/api/t` notes that local development "shares the live database". Anything done on localhost with production keys changes real data. Use Paystack test keys locally, and never run migrations from a laptop without the owner's OK.

## Environment variables

| Service | Variables | Needed |
|---------|-----------|--------|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_DB_PASSWORD` | Required |
| Supabase management | `SUPABASE_ACCESS_TOKEN` | Optional (email template editing) |
| Site | `NEXT_PUBLIC_SITE_URL`, `ETIVIO_OWNER_EMAILS`, `CONTACT_INBOX` | Site URL required; the other two have defaults |
| Cloudflare R2 | `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `NEXT_PUBLIC_R2_PUBLIC_URL` | Required for uploads |
| Paystack | `PAYSTACK_SECRET_KEY` | Required for payments |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_ASSET_URL`, `EMAIL_FROM_ADDRESS`, `EMAIL_SENDER_NAME` | Key and From required |
| Cron | `CRON_SECRET` (must match Vault `cron_secret`) | Required in production |
| Workers AI | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_TOKEN` | Optional; AI and image screening switch off without them |
| Calls TURN | `CF_TURN_KEY_ID`, `CF_TURN_API_TOKEN` | Optional; STUN only without them |
| Firecrawl | `FIRECRAWL_API_KEY` | Optional |

## Toolchain

- Node 20+ (tested on 24), npm with a committed `package-lock.json`. Use `npm ci`.
- TypeScript 5, ESLint 9 + `eslint-config-next`, Tailwind CSS v4.
- Scripts: `dev` (port 3010, header limit raised through `cross-env NODE_OPTIONS`), `build`, `start`, `lint`.
- There is no test suite and no CI workflow yet.

## Local setup

```bash
npm ci
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3010
```
