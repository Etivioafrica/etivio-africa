-- Etivio Africa: dashboard welcome banner background, set by a super admin in Admin > Settings.
-- Null means the built-in default (/hero-bg.webp).

alter table public.platform_settings add column hero_bg_url text;
