-- Etivio Africa: Campus, the shared feed for every learner (after the old app's In-House feed). Posts are an update,
-- question, win, poll or opportunity, with text (#hashtags and @usernames), an optional image or YouTube video, and
-- can quote another post. People like, comment (with one level of replies), save, vote in polls and share.
-- The server checks everything before writing (and runs the content checks from 0048); RLS lets signed-in people read.

create table public.campus_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'update' check (kind in ('update', 'question', 'win', 'poll', 'opportunity')),
  body text not null default '' check (length(body) <= 5000),
  image_url text check (length(image_url) <= 500),
  video_url text check (length(video_url) <= 500),
  quoted_post_id uuid references public.campus_posts (id) on delete set null,
  hashtags text[] not null default '{}',
  poll_multiple boolean not null default false,
  poll_ends_at timestamptz,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  quote_count integer not null default 0,
  hidden boolean not null default false,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);
create index campus_posts_feed_idx on public.campus_posts (created_at desc);
create index campus_posts_author_idx on public.campus_posts (author_id, created_at desc);
create index campus_posts_kind_idx on public.campus_posts (kind, created_at desc);
create index campus_posts_tags_idx on public.campus_posts using gin (hashtags);

create table public.campus_poll_options (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.campus_posts (id) on delete cascade,
  position smallint not null,
  label text not null check (length(label) between 1 and 80),
  vote_count integer not null default 0,
  unique (post_id, position)
);

create table public.campus_poll_votes (
  option_id uuid not null references public.campus_poll_options (id) on delete cascade,
  post_id uuid not null references public.campus_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (option_id, user_id)
);
create index campus_poll_votes_user_idx on public.campus_poll_votes (post_id, user_id);

create table public.campus_likes (
  post_id uuid not null references public.campus_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.campus_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.campus_posts (id) on delete cascade,
  parent_id uuid references public.campus_comments (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index campus_comments_post_idx on public.campus_comments (post_id, created_at);

create table public.campus_saves (
  post_id uuid not null references public.campus_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index campus_saves_user_idx on public.campus_saves (user_id, created_at desc);

-- Keep the counts on posts and poll options in step.
create or replace function public.campus_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  if tg_table_name = 'campus_likes' then
    update public.campus_posts set like_count = greatest(0, like_count + delta) where id = coalesce(new.post_id, old.post_id);
  elsif tg_table_name = 'campus_comments' then
    update public.campus_posts set comment_count = greatest(0, comment_count + delta) where id = coalesce(new.post_id, old.post_id);
  elsif tg_table_name = 'campus_poll_votes' then
    update public.campus_poll_options set vote_count = greatest(0, vote_count + delta) where id = coalesce(new.option_id, old.option_id);
  elsif tg_table_name = 'campus_posts' then
    update public.campus_posts set quote_count = greatest(0, quote_count + delta) where id = coalesce(new.quoted_post_id, old.quoted_post_id);
  end if;
  return null;
end;
$$;
revoke all on function public.campus_counts() from public, anon, authenticated;
create trigger campus_likes_count after insert or delete on public.campus_likes for each row execute function public.campus_counts();
create trigger campus_comments_count after insert or delete on public.campus_comments for each row execute function public.campus_counts();
create trigger campus_votes_count after insert or delete on public.campus_poll_votes for each row execute function public.campus_counts();
create trigger campus_quotes_added after insert on public.campus_posts for each row when (new.quoted_post_id is not null) execute function public.campus_counts();
create trigger campus_quotes_removed after delete on public.campus_posts for each row when (old.quoted_post_id is not null) execute function public.campus_counts();

alter table public.campus_posts enable row level security;
alter table public.campus_poll_options enable row level security;
alter table public.campus_poll_votes enable row level security;
alter table public.campus_likes enable row level security;
alter table public.campus_comments enable row level security;
alter table public.campus_saves enable row level security;

-- Held posts and comments (see 0048) reach only whoever wrote them.
create policy "signed-in people read campus posts" on public.campus_posts for select to authenticated
  using (not hidden or author_id = (select auth.uid()) or public.is_admin());
create policy "signed-in people read poll options" on public.campus_poll_options for select to authenticated using (true);
create policy "people see their own votes" on public.campus_poll_votes for select to authenticated using (user_id = (select auth.uid()));
create policy "signed-in people read likes" on public.campus_likes for select to authenticated using (true);
create policy "signed-in people read campus comments" on public.campus_comments for select to authenticated
  using (not hidden or author_id = (select auth.uid()) or public.is_admin());
create policy "people see their own saves" on public.campus_saves for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.campus_posts, public.campus_poll_options, public.campus_poll_votes, public.campus_likes, public.campus_comments, public.campus_saves from anon, authenticated;
grant select on public.campus_posts, public.campus_poll_options, public.campus_poll_votes, public.campus_likes, public.campus_comments, public.campus_saves to authenticated;

-- The feed shows a "new posts" button when someone else posts.
alter publication supabase_realtime add table public.campus_posts;

-- Campus posts and comments can be reported and caught like everything else.
alter table public.moderation_flags drop constraint moderation_flags_target_type_check;
alter table public.moderation_flags add constraint moderation_flags_target_type_check check (target_type in (
  'community_post', 'community_comment', 'community', 'message', 'support_message', 'blog_comment',
  'course_review', 'product_review', 'course', 'lesson', 'product', 'profile', 'image', 'campus_post', 'campus_comment'
));
