-- Etivio Africa: announcements (ported from the nnamdi-obi community platform).
-- Staff write through the server (service role) after an admin check. Signed-in learners read posts that are
-- published, or scheduled with a time that has passed, so scheduled posts go live on time without a cron job.

create type public.announcement_status as enum ('draft', 'scheduled', 'published', 'archived');

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '',
  status public.announcement_status not null default 'draft',
  pinned boolean not null default false,
  scheduled_at timestamptz,
  cover_image_url text,
  cover_video_url text,
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'scheduled' or scheduled_at is not null)
);

create index announcements_feed_idx on public.announcements (status, pinned desc, created_at desc);

create trigger announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;

create policy "learners read live announcements"
  on public.announcements for select
  to authenticated
  using (status = 'published' or (status = 'scheduled' and scheduled_at <= now()));

revoke all on public.announcements from anon;
revoke insert, update, delete, truncate, trigger, references on public.announcements from authenticated;
grant select on public.announcements to authenticated;
