-- Projects (roadmap item 10): tutors and coaches set practical briefs, learners submit their work, and the best
-- submissions are featured in a public showcase. All writes go through server actions with the service role after
-- checking who is asking, so clients only get read access to what is public.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  title text not null check (char_length(title) between 4 and 120),
  brief text not null default '',
  skills text[] not null default '{}',
  level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  due_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_author_idx on public.projects (author_id, updated_at desc);
create index projects_open_idx on public.projects (status, created_at desc);

create table public.project_submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  summary text not null default '' check (char_length(summary) <= 2000),
  link_url text check (link_url is null or link_url ~* '^https?://'),
  image_url text,
  status text not null default 'submitted' check (status in ('submitted', 'reviewed', 'featured', 'hidden')),
  feedback text check (feedback is null or char_length(feedback) <= 2000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);
create index project_submissions_project_idx on public.project_submissions (project_id, created_at desc);
create index project_submissions_featured_idx on public.project_submissions (status, reviewed_at desc) where status = 'featured';

alter table public.projects enable row level security;
alter table public.project_submissions enable row level security;

-- Public reads: open or closed briefs (never drafts), and featured submissions only.
create policy "anyone reads published projects" on public.projects for select to anon, authenticated using (status in ('open', 'closed'));
create policy "anyone reads featured submissions" on public.project_submissions for select to anon, authenticated using (status = 'featured');

revoke all on public.projects from anon, authenticated;
revoke all on public.project_submissions from anon, authenticated;
grant select on public.projects to anon, authenticated;
grant select (id, project_id, user_id, title, summary, link_url, image_url, status, reviewed_at, created_at) on public.project_submissions to anon, authenticated;

-- Reports and automatic checks can point at briefs and submissions.
alter table public.moderation_flags drop constraint moderation_flags_target_type_check;
alter table public.moderation_flags add constraint moderation_flags_target_type_check check (target_type in (
  'community_post', 'community_comment', 'community', 'message', 'support_message', 'blog_comment',
  'course_review', 'product_review', 'course', 'lesson', 'product', 'profile', 'image', 'campus_post', 'campus_comment',
  'project', 'project_submission'
));
