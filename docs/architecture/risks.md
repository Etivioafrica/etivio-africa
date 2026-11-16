# Risks & notes

Review this list whenever a layer changes. Remove items once they're fixed.

| Severity | Risk | Suggested fix |
|----------|------|---------------|
| High | Local development and production share one database ([environments.md](environments.md)) | Create a dev or staging Supabase project (or use Supabase branching) and point `.env.local` and Vercel Preview at it |
| High | `createAdminClient()` bypasses RLS ([05-auth-roles.md](05-auth-roles.md)) | Every call site must sit behind a role check or a trusted system path. Add it to the PR checklist, or add a lint rule |
| Medium | No automated tests or CI | GitHub Actions on PRs: `npm ci && npm run lint && npm run build` |
| Medium | Cron jobs call `https://etivio.co` directly ([06-database.md](06-database.md)) | Preview deployments can't test them, and a domain change breaks them silently. Keep the URL in Vault or a settings table |
| Medium | Without TURN credentials, coaching calls fail on many mobile networks ([11-realtime-calls.md](11-realtime-calls.md)) | Set `CF_TURN_KEY_ID` and `CF_TURN_API_TOKEN` before switching `coaching` on |
| Low | Functions run in Dublin while most users are likely in Africa | Keep the Vercel region next to the Supabase region; revisit if the database moves |
| Low | Migration numbers are claimed by hand | Follow the claiming rules in `CLAUDE.md` |
