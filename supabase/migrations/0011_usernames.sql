-- Etivio Africa: usernames for shareable public profiles at etivio.co/@username, plus a visibility switch.

alter table public.profiles
  add column username text constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$'),
  add column profile_public boolean not null default true;

create unique index profiles_username_key on public.profiles (username);

grant update (username, profile_public) on public.profiles to authenticated;
