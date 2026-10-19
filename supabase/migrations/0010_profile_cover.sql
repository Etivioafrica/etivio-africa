-- Etivio Africa: profile cover (banner) image, shown on /profile and in Settings.

alter table public.profiles add column cover_url text;

grant update (cover_url) on public.profiles to authenticated;
