-- Etivio Africa: core e-learning schema
-- profiles, courses, modules, lessons, enrollments, lesson progress

create extension if not exists pgcrypto;

-- Enums ---------------------------------------------------------------

create type public.user_role as enum ('student', 'instructor', 'admin');
create type public.course_status as enum ('draft', 'published', 'archived');
create type public.course_level as enum ('beginner', 'intermediate', 'advanced');

-- Shared updated_at trigger --------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles ------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  bio text,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Courses -------------------------------------------------------------

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles (id) on delete restrict,
  title text not null,
  slug text not null unique,
  summary text,
  description text,
  cover_url text,
  level public.course_level not null default 'beginner',
  -- Minor units (kobo for NGN). 0 means free.
  price_minor integer not null default 0 check (price_minor >= 0),
  currency text not null default 'NGN',
  status public.course_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index courses_instructor_idx on public.courses (instructor_id);
create index courses_status_idx on public.courses (status);

create trigger courses_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

-- Modules (sections inside a course) ----------------------------------

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index course_modules_course_idx on public.course_modules (course_id, position);

-- Lessons -------------------------------------------------------------

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  content text,
  video_url text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  position integer not null default 0,
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lessons_module_idx on public.lessons (module_id, position);
create index lessons_course_idx on public.lessons (course_id);

create trigger lessons_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

-- Keep lessons.course_id in sync with its module's course.
create or replace function public.lessons_sync_course_id()
returns trigger
language plpgsql
as $$
begin
  select course_id into new.course_id
  from public.course_modules
  where id = new.module_id;
  return new;
end;
$$;

create trigger lessons_sync_course
  before insert or update on public.lessons
  for each row execute function public.lessons_sync_course_id();

-- Enrollments ---------------------------------------------------------

create table public.enrollments (
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, course_id)
);

create index enrollments_course_idx on public.enrollments (course_id);

-- Lesson progress -----------------------------------------------------

create table public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- Helpers (security definer so policies don't recurse) ----------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_instructor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('instructor', 'admin')
  );
$$;

create or replace function public.owns_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.courses
    where id = p_course_id and instructor_id = auth.uid()
  );
$$;

create or replace function public.course_is_published(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.courses
    where id = p_course_id and status = 'published'
  );
$$;

create or replace function public.is_enrolled(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.enrollments
    where course_id = p_course_id and user_id = auth.uid()
  );
$$;

-- Row level security --------------------------------------------------

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;

-- Profiles: public read (instructor names on course pages), self update.
create policy "profiles are readable by everyone"
  on public.profiles for select
  using (true);

create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Users can edit their own details but never their role.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, bio) on public.profiles to authenticated;

-- Courses
create policy "published courses are readable by everyone"
  on public.courses for select
  using (status = 'published' or instructor_id = auth.uid() or public.is_admin());

create policy "instructors create their own courses"
  on public.courses for insert
  to authenticated
  with check (instructor_id = auth.uid() and public.is_instructor());

create policy "instructors update their own courses"
  on public.courses for update
  to authenticated
  using (instructor_id = auth.uid() or public.is_admin())
  with check (instructor_id = auth.uid() or public.is_admin());

create policy "instructors delete their own draft courses"
  on public.courses for delete
  to authenticated
  using ((instructor_id = auth.uid() and status = 'draft') or public.is_admin());

-- Modules: curriculum outline is visible on published courses.
create policy "modules of published courses are readable"
  on public.course_modules for select
  using (
    public.course_is_published(course_id)
    or public.owns_course(course_id)
    or public.is_admin()
  );

create policy "course owners manage modules"
  on public.course_modules for all
  to authenticated
  using (public.owns_course(course_id) or public.is_admin())
  with check (public.owns_course(course_id) or public.is_admin());

-- Lessons: full content only for enrolled students, previews, or owners.
create policy "lesson content for enrolled, preview, or owner"
  on public.lessons for select
  using (
    (public.course_is_published(course_id) and (is_preview or public.is_enrolled(course_id)))
    or public.owns_course(course_id)
    or public.is_admin()
  );

create policy "course owners manage lessons"
  on public.lessons for all
  to authenticated
  using (public.owns_course(course_id) or public.is_admin())
  with check (public.owns_course(course_id) or public.is_admin());

-- Enrollments: students see their own; owners see their course's students.
create policy "read own or owned-course enrollments"
  on public.enrollments for select
  to authenticated
  using (user_id = auth.uid() or public.owns_course(course_id) or public.is_admin());

-- Self-enrollment is only allowed for free, published courses.
-- Paid enrollments are written by the server (service role) after payment verification.
create policy "students self-enroll in free courses"
  on public.enrollments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.courses c
      where c.id = course_id and c.status = 'published' and c.price_minor = 0
    )
  );

-- Lesson progress: own rows only, and only for courses you're enrolled in.
create policy "read own progress"
  on public.lesson_progress for select
  to authenticated
  using (user_id = auth.uid());

create policy "record own progress when enrolled"
  on public.lesson_progress for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.lessons l
      where l.id = lesson_id and public.is_enrolled(l.course_id)
    )
  );

create policy "clear own progress"
  on public.lesson_progress for delete
  to authenticated
  using (user_id = auth.uid());
