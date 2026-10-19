-- Etivio Africa: signed-out visitors may only read public profile fields.
-- Before this, `anon` could read every column, including welcome-guide answers, email preferences,
-- and account status. Public pages (/@username, certificates) read through the server; the landing
-- page only needs instructor names.

revoke select on public.profiles from anon;

grant select (
  id, full_name, avatar_url, cover_url, bio, headline, location, username, profile_public,
  website_url, linkedin_url, x_url, interests, created_at
) on public.profiles to anon;
