-- Etivio Africa: richer learner profiles + account preferences.
-- Profile fields stay publicly readable (existing select policy); users edit their own via column grants.

alter table public.profiles
  add column headline text check (char_length(headline) <= 120),
  add column location text check (char_length(location) <= 80),
  add column website_url text,
  add column linkedin_url text,
  add column x_url text,
  add column interests text[] not null default '{}' check (cardinality(interests) <= 12),
  add column notification_prefs jsonb not null default '{"course_updates": true, "support_replies": true, "product_news": false}';

grant update (headline, location, website_url, linkedin_url, x_url, interests, notification_prefs)
  on public.profiles to authenticated;
