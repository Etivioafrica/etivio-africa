# 5 · Auth & roles

**Source of truth:** `src/lib/auth.ts`, `src/lib/roles.ts`, `src/lib/owner.ts`, `src/lib/supabase/*`, `src/app/(auth)`, `src/app/auth`
**Service:** Supabase Auth

## Sign-in

- Email and password, or **Google OAuth**.
- Sessions are stored in Supabase cookies (`sb-…-auth-token`) by `@supabase/ssr`.
- Page loads verify the JWT locally against the project's ES256 signing key with `auth.getClaims()` (`src/lib/supabase/session.ts`). The JWKS is fetched once and cached, so pages don't wait on Supabase Auth.
- Sensitive writes (password, email or role changes) use `auth.getUser()` for the freshest state.
- `requireFullSession()` and `getCurrentUser()` (memoised with React `cache()`) live in `src/lib/auth.ts`.
- Auth emails are sent through Resend's SMTP (see [09-email.md](09-email.md)).

## Supabase clients

Choosing the client is a security decision.

| Client | Key | Use |
|--------|-----|-----|
| `supabase/client.ts` | Publishable | Browser and Realtime; limited by RLS |
| `supabase/server.ts` | Publishable + request cookies | Server code acting as the signed-in person; limited by RLS |
| `supabase/proxy.ts` | Publishable + request cookies | Session refresh in the proxy |
| `supabase/admin.ts` | **Secret (service role)** | **Bypasses RLS.** Server-only. Use it only after `requireAdmin()` / `requireSuperAdmin()`, or for trusted system paths (webhook, cron, upload checks) |

## Roles

`app_role` is a Postgres enum, and a person can hold several roles.

| Group | Roles |
|-------|-------|
| Staff (`STAFF_ROLES`) | `super_admin`, `editor`, `accountant` (shown as "Accounts"), `reviewer` |
| Creators (`CREATOR_ROLES`) | `tutor`, `coach`, `event_manager`, `community_owner` |
| Default | `student` |

Helpers: `isStaff`, `canTeach` (tutor or super admin), `isCoach`, `canEarn`, `showsTeach`, `primaryRole`, `canAccess(roles, area)`.

## Admin areas (`ADMIN_AREAS`)

| Area | Roles |
|------|-------|
| dashboard, settings | super_admin, editor, accountant |
| review, moderation | super_admin, reviewer |
| blog, announcements | super_admin, editor |
| financials, coupons | super_admin, accountant |
| users, courses, marketplace, documents, chats, tracking, coaching, communities, team, emails, platform | super_admin |

## Owner protection

Owner accounts come from `ETIVIO_OWNER_EMAILS` (comma-separated). Other admins can't change, suspend or delete them, and only an owner can grant or remove Super admin. Staff role changes notify the person (by email and in the app) and email the owner.
