-- Etivio Africa: content moderation. Everything people type (posts, comments, messages, reviews, profiles, course and
-- product text) is checked before it's saved, and uploaded images are checked when they arrive. What gets caught, and
-- what people report, lands in moderation_flags for Admin › Moderation. Strikes build up per user: 3 mutes them for
-- 7 days, 5 suspends the account.
-- Only the server (service role) reads or writes these tables.

create table public.moderation_flags (
  id uuid primary key default gen_random_uuid(),
  -- What was flagged. target_id is null for text that was blocked before it was saved.
  target_type text not null check (target_type in (
    'community_post', 'community_comment', 'community', 'message', 'support_message', 'blog_comment',
    'course_review', 'product_review', 'course', 'lesson', 'product', 'profile', 'image'
  )),
  target_id text,
  author_id uuid references public.profiles (id) on delete set null,
  excerpt text check (length(excerpt) <= 2000),
  link text check (length(link) <= 500),
  -- auto: caught by the checks. report: someone pressed Report.
  source text not null check (source in ('auto', 'report')),
  reason text not null check (reason in ('sexual', 'harassment', 'hate', 'violence', 'spam', 'other')),
  details text check (length(details) <= 500),
  reporter_id uuid references public.profiles (id) on delete set null,
  -- blocked: stopped before saving (kept as a record). open: waiting for staff. removed / dismissed: decided.
  status text not null default 'open' check (status in ('blocked', 'open', 'removed', 'dismissed')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index moderation_flags_status_idx on public.moderation_flags (status, created_at desc);
create index moderation_flags_target_idx on public.moderation_flags (target_type, target_id);
create index moderation_flags_author_idx on public.moderation_flags (author_id, created_at desc);
-- One report per person per thing.
create unique index moderation_flags_one_report on public.moderation_flags (target_type, target_id, reporter_id) where reporter_id is not null;

create table public.user_strikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  flag_id uuid references public.moderation_flags (id) on delete set null,
  reason text not null check (length(reason) <= 300),
  given_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index user_strikes_user_idx on public.user_strikes (user_id, created_at desc);

alter table public.profiles
  add column strikes integer not null default 0,
  add column muted_until timestamptz;

-- Held back while staff look at it (caught as borderline, or reported 3 times).
alter table public.community_posts add column hidden boolean not null default false;
alter table public.community_comments add column hidden boolean not null default false;
alter table public.conversation_messages add column hidden boolean not null default false;

alter table public.moderation_flags enable row level security;
alter table public.user_strikes enable row level security;
revoke all on public.moderation_flags, public.user_strikes from anon, authenticated;

-- Held messages, posts and comments reach only whoever wrote them (also over Realtime), and a held message doesn't
-- update the conversation preview or the other side's unread count.
drop policy "people see messages in their conversations" on public.conversation_messages;
create policy "people see messages in their conversations" on public.conversation_messages for select to authenticated
  using (
    (not hidden or sender_id = (select auth.uid()))
    and exists (select 1 from public.conversations c where c.id = conversation_id and (c.student_id = (select auth.uid()) or c.tutor_id = (select auth.uid())))
  );
drop policy "members read posts" on public.community_posts;
create policy "members read posts" on public.community_posts for select to authenticated
  using ((not hidden or author_id = (select auth.uid()) or public.is_admin()) and (public.is_community_member(community_id) or public.is_admin()));
drop policy "members read comments" on public.community_comments;
create policy "members read comments" on public.community_comments for select to authenticated
  using (
    (not hidden or author_id = (select auth.uid()) or public.is_admin())
    and exists (select 1 from public.community_posts p where p.id = post_id and (public.is_community_member(p.community_id) or public.is_admin()))
  );

create or replace function public.on_conversation_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.hidden then
    return new;
  end if;
  update public.conversations c
     set last_message = left(new.body, 140),
         last_message_at = new.created_at,
         student_unread = case when new.sender_id = c.tutor_id then c.student_unread + 1 else c.student_unread end,
         tutor_unread = case when new.sender_id = c.student_id then c.tutor_unread + 1 else c.tutor_unread end
   where c.id = new.conversation_id;
  return new;
end;
$$;
