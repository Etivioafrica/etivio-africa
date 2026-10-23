-- Etivio Africa: communities. Spaces with posts and comments. Admins create any community (the official Etivio one,
-- topic spaces); tutors and community owners can create one, for example for their own course.
-- Join modes: open (join straight away), request (answer a question, an owner or moderator approves), course
-- (anyone enrolled in the linked course is let in) and invite (only with the invite link).
-- The server checks everything before writing; RLS lets members read their communities.

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name text not null check (length(name) between 3 and 80),
  description text check (length(description) <= 600),
  cover_url text,
  owner_id uuid references public.profiles (id) on delete set null,
  join_mode text not null default 'open' check (join_mode in ('open', 'request', 'course', 'invite')),
  course_id uuid references public.courses (id) on delete set null,
  join_question text check (length(join_question) <= 200),
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  is_official boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);
create index communities_course_idx on public.communities (course_id);

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'moderator', 'member')),
  status text not null default 'active' check (status in ('active', 'pending', 'banned')),
  answer text check (length(answer) <= 500),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index community_members_user_idx on public.community_members (user_id, status);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(body) between 1 and 5000),
  pinned boolean not null default false,
  comment_count integer not null default 0,
  like_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index community_posts_feed_idx on public.community_posts (community_id, pinned desc, created_at desc);

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index community_comments_post_idx on public.community_comments (post_id, created_at);

create table public.community_likes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Keep counts on posts in step with comments and likes.
create or replace function public.community_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'community_comments' then
    update public.community_posts set comment_count = greatest(0, comment_count + case when tg_op = 'INSERT' then 1 else -1 end)
     where id = coalesce(new.post_id, old.post_id);
  else
    update public.community_posts set like_count = greatest(0, like_count + case when tg_op = 'INSERT' then 1 else -1 end)
     where id = coalesce(new.post_id, old.post_id);
  end if;
  return null;
end;
$$;
revoke all on function public.community_counts() from public, anon, authenticated;
create trigger community_comment_count after insert or delete on public.community_comments for each row execute function public.community_counts();
create trigger community_like_count after insert or delete on public.community_likes for each row execute function public.community_counts();

alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_likes enable row level security;

create or replace function public.is_community_member(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.community_members where community_id = p_community and user_id = (select auth.uid()) and status = 'active');
$$;

create policy "active communities are listed" on public.communities for select to authenticated using (status = 'active' or public.is_admin());
create policy "members see the member list" on public.community_members for select to authenticated using (user_id = (select auth.uid()) or public.is_community_member(community_id) or public.is_admin());
create policy "members read posts" on public.community_posts for select to authenticated using (public.is_community_member(community_id) or public.is_admin());
create policy "members read comments" on public.community_comments for select to authenticated
  using (exists (select 1 from public.community_posts p where p.id = post_id and (public.is_community_member(p.community_id) or public.is_admin())));
create policy "members read likes" on public.community_likes for select to authenticated
  using (exists (select 1 from public.community_posts p where p.id = post_id and (public.is_community_member(p.community_id) or public.is_admin())));
revoke all on public.communities, public.community_members, public.community_posts, public.community_comments, public.community_likes from anon, authenticated;
grant select on public.communities, public.community_members, public.community_posts, public.community_comments, public.community_likes to authenticated;
