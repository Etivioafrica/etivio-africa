-- Etivio Africa: private profile fields are readable only by their owner.
-- Signed-in users could read any learner's welcome-guide answers, preferences, and account status.
-- Now every user (signed in or not) reads only public columns of profiles, and reads their own
-- private fields through my_profile(), which only ever returns the caller's row.

revoke select on public.profiles from authenticated;

grant select (
  id, full_name, avatar_url, cover_url, bio, headline, location, username, profile_public,
  website_url, linkedin_url, x_url, interests, created_at
) on public.profiles to authenticated;

create or replace function public.my_profile()
returns table (
  status public.account_status,
  deleted_at timestamptz,
  last_seen_at timestamptz,
  notification_prefs jsonb,
  learning_goal text,
  skill_level text,
  weekly_hours text,
  weekly_goal smallint,
  onboarded_at timestamptz,
  show_current_learning boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select status, deleted_at, last_seen_at, notification_prefs, learning_goal, skill_level, weekly_hours,
         weekly_goal, onboarded_at, show_current_learning, updated_at
  from public.profiles
  where id = auth.uid();
$$;

revoke execute on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- Soft-deleted accounts disappear for everyone except the server (service role bypasses RLS).
-- This replaces client-side `deleted_at is null` filters, which can no longer read that column.
drop policy "profiles are readable by everyone" on public.profiles;

create policy "active profiles are readable by everyone"
  on public.profiles for select
  using (deleted_at is null);
