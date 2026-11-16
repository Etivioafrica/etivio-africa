# 6 · Database

**Source of truth:** `supabase/migrations/`, `src/lib/database.types.ts`, `scripts/schema.sql`, `scripts/gen-types.py`
**Service:** Supabase Postgres

All application data lives in one Supabase Postgres database. The schema is built by **61 numbered migrations**, `0001_elearning_core.sql` to `0061_projects.sql`. Every one of the **77 tables** has row level security enabled, so the publishable key alone can't read private rows.

Migration numbering and claiming rules are in `CLAUDE.md`. Never edit a migration that has already merged.

## Domains

| Domain | Migrations |
|--------|-----------|
| Courses, lessons, enrolments, progress, watch tracking, access periods, categories | 0001, 0003, 0016, 0025, 0026, 0056, 0057 |
| Profiles, usernames, covers, badges, onboarding, learner goals | 0008, 0010, 0011, 0013–0015, 0018–0020, 0054, 0055 |
| Roles, staff, admin, review queue | 0002, 0004, 0005, 0007, 0038, 0039 |
| Grants hardening | 0017 |
| Orders, guest checkout, coupons, group buy, wallet top-ups | 0031, 0032, 0041, 0042, 0045 |
| Marketplace products and reviews | 0029, 0034, 0037 |
| Payment methods, billing, payouts, tutor withdrawals | 0009, 0012, 0043 |
| Blog, announcements, course announcements | 0022, 0024, 0030 |
| Email log and templates | 0027, 0028 |
| Messages, AI messages, course messages, notifications, staff support | 0040, 0044, 0058, 0059 |
| Campus, communities, moderation | 0047, 0048, 0051–0053 |
| Coaching and session calls | 0049, 0050 |
| Tracking, page views, visits | 0006, 0023, 0035, 0036 |
| Platform settings, feature flags, referrals, projects | 0021, 0046, 0060, 0061 |
| Checkout reminder cron | 0033 |

## Scheduled jobs (pg_cron)

| Job | Schedule | Defined in | What it does |
|-----|----------|-----------|--------------|
| `checkout-reminders` | `*/10 * * * *` | 0033 | pg_net GETs `https://etivio.co/api/cron/checkout-reminders` with `Bearer <vault cron_secret>` |
| `coach-reminders` | `*/10 * * * *` | 0049 | pg_net GETs `https://etivio.co/api/cron/coach-reminders` |
| `prune-old-page-views` | `30 2 * * *` | 0023 | Deletes `activity_events` page views older than 90 days |
| `prune-old-visits` | `45 2 * * *` | 0035 | Deletes `visits` older than 13 months |
| `email-log-retention` | `30 3 * * *` | 0027 | Deletes `email_log` rows older than 180 days |
| group-buy job | see file | 0041 | Group-buy housekeeping |

The cron secret is stored in **Supabase Vault** (`cron_secret`) and must match `CRON_SECRET` in Vercel. It is never committed.

## Types

`src/lib/database.types.ts` is generated without Docker:

```bash
psql "<conn>" -tA -f scripts/schema.sql > schema.json
python3 scripts/gen-types.py schema.json
```

Don't hand-merge conflicts in this file. Regenerate it instead.
