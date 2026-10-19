-- Etivio Africa: more platform settings, managed by super admins in Admin > Settings.

alter table public.platform_settings
  add column support_whatsapp text check (support_whatsapp ~ '^\+?[0-9 ]{7,20}$'),
  add column social_x text,
  add column social_instagram text,
  add column social_linkedin text,
  add column social_youtube text,
  add column social_tiktok text,
  add column tutor_applications_open boolean not null default true,
  add column certificate_signer_name text check (char_length(certificate_signer_name) <= 80),
  add column certificate_signer_title text check (char_length(certificate_signer_title) <= 80),
  add column announcement_text text check (char_length(announcement_text) <= 200),
  add column announcement_link text,
  add column announcement_active boolean not null default false;
