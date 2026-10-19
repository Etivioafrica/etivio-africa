-- Etivio Africa: course admin sub-pages. Managed categories, featured courses, reviews, module quizzes,
-- and certificate revocation. Learners never write these tables directly: the server checks the rules
-- (enrolled, 30% progress, quiz grading) and writes with the service role.

-- Categories ------------------------------------------------------------------------

create table public.course_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  slug text not null unique,
  parent_id uuid references public.course_categories (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.course_categories enable row level security;
create policy "course categories are public" on public.course_categories for select using (true);
revoke all on public.course_categories from anon, authenticated;
grant select on public.course_categories to anon, authenticated;

-- Seed with the topics learners pick in the welcome guide, plus anything already used on courses.
insert into public.course_categories (name, slug)
select name, trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
from (
  select unnest(array['Design', 'Development', 'Marketing', 'Business', 'Data & AI', 'Product', 'Content creation', 'Finance', 'Photography & video', 'Writing', 'Sales', 'Personal growth']) as name
  union
  select distinct category from public.courses where category is not null
) t
on conflict (slug) do nothing;

alter table public.courses
  add column category_id uuid references public.course_categories (id) on delete set null,
  add column featured boolean not null default false;

update public.courses c set category_id = cc.id from public.course_categories cc where cc.name = c.category and c.category_id is null;

-- Reviews (allowed after 30% progress; hidden until an admin approves) -------------------------

create table public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  approved boolean not null default false,
  admin_reply text check (char_length(admin_reply) <= 2000),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id)
);

create index course_reviews_course_idx on public.course_reviews (course_id, approved);

create trigger course_reviews_updated_at
  before update on public.course_reviews
  for each row execute function public.set_updated_at();

alter table public.course_reviews enable row level security;
create policy "approved reviews and your own are readable"
  on public.course_reviews for select to authenticated
  using (approved or user_id = auth.uid());
revoke all on public.course_reviews from anon, authenticated;
grant select on public.course_reviews to authenticated;

-- Quizzes (one per module; passing it unlocks the next module) ------------------------------

create table public.course_quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  module_id uuid not null unique references public.course_modules (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  pass_mark smallint not null default 70 check (pass_mark between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.course_quizzes (id) on delete cascade,
  position integer not null default 0,
  prompt text not null check (char_length(prompt) between 1 and 500),
  options text[] not null check (cardinality(options) between 2 and 6),
  correct_index smallint not null check (correct_index >= 0),
  explanation text check (char_length(explanation) <= 1000),
  check (correct_index < cardinality(options))
);

create index quiz_questions_quiz_idx on public.quiz_questions (quiz_id, position);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.course_quizzes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score smallint not null check (score between 0 and 100),
  passed boolean not null,
  answers jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index quiz_attempts_user_idx on public.quiz_attempts (user_id, quiz_id, passed);

alter table public.course_quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;

-- Quiz titles are visible to enrolled learners; questions (with answers) only ever go through the server.
create policy "quizzes are readable by enrolled learners"
  on public.course_quizzes for select to authenticated
  using (exists (select 1 from public.enrollments e where e.course_id = course_quizzes.course_id and e.user_id = auth.uid()));
create policy "learners read their own attempts"
  on public.quiz_attempts for select to authenticated
  using (user_id = auth.uid());

revoke all on public.course_quizzes, public.quiz_questions, public.quiz_attempts from anon, authenticated;
grant select on public.course_quizzes, public.quiz_attempts to authenticated;

-- Quizzes passed per course for one learner. Counts only, so it is safe for profile pages.
create or replace function public.quiz_progress(p_user_id uuid, p_course_ids uuid[])
returns table (course_id uuid, quizzes integer, passed integer)
language sql
stable
security definer
set search_path = public
as $$
  select q.course_id,
    count(*)::integer,
    count(*) filter (where exists (select 1 from quiz_attempts a where a.quiz_id = q.id and a.user_id = p_user_id and a.passed))::integer
  from course_quizzes q
  where q.course_id = any (p_course_ids)
  group by q.course_id;
$$;

revoke all on function public.quiz_progress(uuid, uuid[]) from public;
grant execute on function public.quiz_progress(uuid, uuid[]) to anon, authenticated, service_role;

-- Certificates can be revoked (kept for the record, shown as revoked when verified) -------------

alter table public.certificates
  add column revoked_at timestamptz,
  add column revoked_reason text check (char_length(revoked_reason) <= 300);

-- Per-course numbers for the admin list and metrics.
create or replace function public.course_metrics()
returns table (course_id uuid, students integer, completed integer, revenue_minor bigint, rating numeric, reviews integer, pending_reviews integer)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
    (select count(*) from enrollments e where e.course_id = c.id)::integer,
    (select count(*) from certificates ce where ce.course_id = c.id and ce.revoked_at is null)::integer,
    coalesce((select sum(p.amount_minor) from payments p where p.course_id = c.id and p.status = 'success'), 0)::bigint,
    (select round(avg(r.rating)::numeric, 1) from course_reviews r where r.course_id = c.id and r.approved),
    (select count(*) from course_reviews r where r.course_id = c.id and r.approved)::integer,
    (select count(*) from course_reviews r where r.course_id = c.id and not r.approved)::integer
  from courses c;
$$;

revoke all on function public.course_metrics() from public, anon, authenticated;
grant execute on function public.course_metrics() to service_role;

-- Public star ratings for course cards (approved reviews only).
create or replace function public.course_ratings(p_course_ids uuid[])
returns table (course_id uuid, rating numeric, reviews integer)
language sql
stable
security definer
set search_path = public
as $$
  select r.course_id, round(avg(r.rating)::numeric, 1), count(*)::integer
  from course_reviews r
  where r.approved and r.course_id = any (p_course_ids)
  group by r.course_id;
$$;

revoke all on function public.course_ratings(uuid[]) from public;
grant execute on function public.course_ratings(uuid[]) to anon, authenticated, service_role;
