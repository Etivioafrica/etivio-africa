-- Etivio Africa: full blog (modelled on the Finance with Anne admin).
-- Posts gain scheduling, a featured flag and SEO fields; new tables for categories, views, likes, comments,
-- and curated links. Readers never write to these tables directly: the server does it with the service
-- role after validating input, so only the public read policies below are exposed.

-- Posts ---------------------------------------------------------------------------

alter type public.post_status add value if not exists 'scheduled';

alter table public.blog_posts
  add column featured boolean not null default false,
  add column meta_title text check (char_length(meta_title) <= 120),
  add column meta_description text check (char_length(meta_description) <= 320),
  add column focus_keyword text check (char_length(focus_keyword) <= 80);

-- Only one featured post at a time.
create unique index blog_posts_one_featured on public.blog_posts (featured) where featured;

-- Live = published (or scheduled and its time has come). Drafts stay admin-only.
drop policy "published posts are readable by everyone" on public.blog_posts;
create policy "live posts are readable by everyone"
  on public.blog_posts for select
  using ((status <> 'draft' and published_at <= now()) or public.is_admin());

-- Categories (one level of subcategories) --------------------------------------------

create table public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  slug text not null unique,
  parent_id uuid references public.blog_categories (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.blog_post_categories (
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  category_id uuid not null references public.blog_categories (id) on delete cascade,
  primary key (post_id, category_id)
);

create index blog_post_categories_category_idx on public.blog_post_categories (category_id);

alter table public.blog_categories enable row level security;
alter table public.blog_post_categories enable row level security;

create policy "categories are public" on public.blog_categories for select using (true);
create policy "post categories are public" on public.blog_post_categories for select using (true);

revoke all on public.blog_categories, public.blog_post_categories from anon, authenticated;
grant select on public.blog_categories, public.blog_post_categories to anon, authenticated;

-- Reader activity (server-only) ---------------------------------------------------------

create table public.blog_post_views (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  country text check (char_length(country) <= 2),
  read_seconds integer check (read_seconds between 0 and 86400),
  created_at timestamptz not null default now()
);

create index blog_post_views_post_idx on public.blog_post_views (post_id, created_at desc);

create table public.blog_likes (
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  fingerprint text not null check (char_length(fingerprint) between 8 and 64),
  created_at timestamptz not null default now(),
  primary key (post_id, fingerprint)
);

create table public.blog_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  author_name text not null check (char_length(author_name) between 1 and 80),
  author_email text check (char_length(author_email) <= 200),
  content text not null check (char_length(content) between 1 and 2000),
  approved boolean not null default false,
  admin_reply text check (char_length(admin_reply) <= 2000),
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index blog_comments_post_idx on public.blog_comments (post_id, approved, created_at);

create table public.blog_curated (
  id uuid primary key default gen_random_uuid(),
  url text not null check (url ~ '^https?://' and char_length(url) <= 2000),
  source_name text not null check (char_length(source_name) <= 80),
  title text not null check (char_length(title) <= 300),
  excerpt text check (char_length(excerpt) <= 600),
  cover_url text check (char_length(cover_url) <= 2000),
  published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.blog_post_views enable row level security;
alter table public.blog_likes enable row level security;
alter table public.blog_comments enable row level security;
alter table public.blog_curated enable row level security;

revoke all on public.blog_post_views, public.blog_likes, public.blog_comments, public.blog_curated from anon, authenticated;

-- Per-post numbers for the admin Metrics page and the posts list.
create or replace function public.blog_post_metrics()
returns table (post_id uuid, views integer, likes integer, comments integer, pending integer, avg_read integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
    (select count(*) from blog_post_views v where v.post_id = p.id)::integer,
    (select count(*) from blog_likes l where l.post_id = p.id)::integer,
    (select count(*) from blog_comments c where c.post_id = p.id)::integer,
    (select count(*) from blog_comments c where c.post_id = p.id and not c.approved)::integer,
    (select round(avg(read_seconds))::integer from blog_post_views v where v.post_id = p.id and v.read_seconds >= 3)
  from blog_posts p;
$$;

revoke all on function public.blog_post_metrics() from public, anon, authenticated;
grant execute on function public.blog_post_metrics() to service_role;
