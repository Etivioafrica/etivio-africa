# Backend tests

Fast, isolated unit tests for the server code: API route handlers and the `lib` code behind them. Supabase, Paystack,
R2, moderation and email are all mocked, so nothing here touches the network, a database or a real secret.

## Setup

```bash
npm install -D vitest        # the only dependency; also updates package-lock.json
npm test                     # run everything once
npm run test:watch           # re-run on save
npx vitest run tests/api/cron.test.ts          # one file
npx vitest run -t "amount mismatch"            # tests whose name matches
```

Optional coverage:

```bash
npm install -D @vitest/coverage-v8
npx vitest run --coverage --coverage.include="src/app/api/**" --coverage.include="src/lib/**"
```

Needs Node 20+ (the same as the app). No `.env` is needed: tests set the few variables they use with `vi.stubEnv`.

## What is covered

| File | What it protects |
|---|---|
| `lib/paystack-signature.test.ts` | Webhook HMAC check: forged, tampered, missing and wrong-secret signatures |
| `lib/fulfill-order.test.ts` | `fulfillOrder` / `completeFreeOrder`: idempotency, amount/currency mismatch, wallet, coupons, guest accounts, group buys, card saving |
| `api/paystack-webhook.test.ts` | Signature gate, re-verification with Paystack, never trusting payload amounts, retry behaviour |
| `api/paystack-callback.test.ts` | Reference validation, verify-then-fulfil, redirects, failure reminders |
| `api/cron.test.ts` | Both cron routes: `Bearer <CRON_SECRET>` or nothing, fail-closed when the secret is unset |
| `api/download.test.ts` | Ownership / creator / admin access, signed link, malformed ids, login redirect |
| `api/upload-sign.test.ts` | Size limits (boundary), blocked names, key scoped to the signed-in user |
| `api/upload-permissions.test.ts` | Who may upload which kind (member / tutor / editor / super admin), suspended and deleted accounts |
| `lib/upload-safety.test.ts` | Real-content file checks: disguised executables, HTML/SVG, renamed files, wrong kind |
| `api/blog-comments.test.ts` | Validation, honeypot, per-email rate limit, moderation, insert failure |
| `api/blog-likes.test.ts` | Toggle, fingerprint validation, unpublished posts |
| `api/tracker.test.ts` | Bot and Origin filtering, channel detection, cookies, path rules |
| `lib/blog-server.test.ts` | `livePostId`, `readJson` size cap, fingerprint format |

Every function or endpoint has a **happy path**, **edge cases**, and **error handling & security** group, written
Arrange-Act-Assert.

## Helpers

- `helpers/fake-supabase.ts`: a chainable fake client. Script results per table (`fakeClient({ orders: [first, second] })`;
  the Nth query on a table gets the Nth result, then the last repeats) and per RPC. Then assert on what was written:
  `db.did("orders", "update")`, `db.argsOf("wallet_transactions", "insert")`, `db.rpc`.
  `fakeAuthClient(user)` adds `auth.getUser()` / `getClaims()` for session-based routes.
- `helpers/request.ts`: `req()` / `post()` build a `NextRequest` (JSON body, raw body, headers, cookies).
- `stubs/server-only.ts`: stands in for the `server-only` package, which throws outside a React Server environment.

Mock module paths use the `@/` alias, which `vitest.config.ts` maps to `src/`.

## Adding a test

1. `vi.mock(...)` the modules the code under test imports (before importing the code).
2. Script the data it reads with `fakeClient`.
3. Call the exported handler (`GET`, `POST`) or function with a request from `helpers/request.ts`.
4. Assert on the response (status and body) and on the side effects (rows written, emails queued, mocks called).

## Not covered (yet)

- RLS policies and SQL functions (`spend_wallet`, `track_visit`, ...). Those need a real Postgres: use
  `supabase start` and pgTAP, or a throwaway Supabase project.
- AI routes (`/api/ai/*`), `/api/export`, `/api/upload/finish` (image screening needs `sharp`), and the admin server actions.
- End-to-end checkout against Paystack's test mode (Playwright).
