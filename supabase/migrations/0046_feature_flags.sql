-- Etivio Africa: feature switches. Each feature is off, staff only (for testing), or on for everyone. Features
-- without a row use the default in src/lib/features.ts. Not secret: anyone may read them.
create table public.feature_flags (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  status text not null default 'on' check (status in ('off', 'staff', 'on')),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.feature_flags enable row level security;
create policy "anyone reads feature switches" on public.feature_flags for select to anon, authenticated using (true);
revoke all on public.feature_flags from anon, authenticated;
grant select on public.feature_flags to anon, authenticated;
