-- Etivio Africa: outgoing email. Every send (or skip) is logged for the admin Emails page and for throttling.
-- Only the service role touches this table.

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  to_email text not null,
  kind text not null,
  subject text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_id text,
  error text,
  -- What the email was about (thread, course, announcement id), used to avoid repeat sends.
  ref text,
  created_at timestamptz not null default now()
);

create index email_log_recent_idx on public.email_log (created_at desc);
create index email_log_ref_idx on public.email_log (kind, ref, created_at desc);

alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

-- Keep six months of history.
select cron.schedule('email-log-retention', '30 3 * * *', $$delete from public.email_log where created_at < now() - interval '180 days'$$);

-- Announcements are emailed once, when they go live. Existing ones count as already sent.
alter table public.announcements add column emailed_at timestamptz;
update public.announcements set emailed_at = now();
