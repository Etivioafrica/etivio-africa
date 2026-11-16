# 9 · Email

**Source of truth:** `src/lib/email/*`, `supabase/templates/*`, `scripts/configure-auth-email.mjs`, `scripts/build-auth-templates.ts`
**Service:** Resend

Email goes out through Resend on two routes.

## App email (Resend REST API)

- Sent from `src/lib/email/send.ts` to `https://api.resend.com` with `RESEND_API_KEY`.
- Covers receipts, announcements (emailed once when they go live), staff notices, role changes, coaching reminders, checkout reminders, the contact form and support notices.
- Modules: `registry.ts` (every email type), `templates.ts`, `stored.ts` (admin-edited templates in the database), `starter.ts`, `layout.ts`, `site.ts`, `recipients.ts`, `notify.ts`, `staff.ts`, `coaching.ts`, `auth-links.ts`.
- Admins edit templates in **Admin → Emails** with `react-email-editor`.
- Every send is written to `email_log`, which is pruned after 180 days.
- The sender is `EMAIL_FROM` (`Etivio <support@etivio.co>`), on a domain verified in Resend. `EMAIL_REPLY_TO` is optional. `EMAIL_ASSET_URL` sets the base URL for images (default `https://etivio.co`).

## Auth email (Supabase → Resend SMTP)

- Confirmation, recovery, magic link, invite and email change are sent by Supabase Auth through `smtp.resend.com:465`.
- The branded HTML is in `supabase/templates/*.html`, with subjects in `subjects.json`.
- Install or refresh them with:

```bash
SUPABASE_ACCESS_TOKEN=sbp_... RESEND_API_KEY=re_... node scripts/configure-auth-email.mjs
```

The script also raises Supabase's email rate limit to 100 an hour. Admins can also edit auth templates from Admin → Emails → Templates, which uses `SUPABASE_ACCESS_TOKEN` and the Supabase Management API.
