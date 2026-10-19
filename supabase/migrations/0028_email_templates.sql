-- Etivio Africa: email designs edited in Admin → Emails → Templates (Unlayer drag-and-drop builder).
-- One row per customised email; emails without a row use the built-in design. Service role only.

create table public.email_templates (
  key text primary key,
  subject text not null check (char_length(subject) between 1 and 200),
  -- The editor's own JSON, so the design can be reopened and edited.
  design jsonb not null,
  -- Exported HTML with {{placeholders}}, filled in per recipient when sending.
  html text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.email_templates enable row level security;
revoke all on public.email_templates from anon, authenticated;
