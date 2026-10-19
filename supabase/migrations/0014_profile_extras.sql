-- Etivio Africa: certificates, weekly goals, course skills, saved courses, lesson notes/bookmarks,
-- and a switch for showing "currently learning" on public profiles.

-- Profile settings ------------------------------------------------------------

alter table public.profiles
  add column weekly_goal smallint check (weekly_goal between 1 and 50),
  add column show_current_learning boolean not null default true;

grant update (weekly_goal, show_current_learning) on public.profiles to authenticated;

-- Course skills (set by the tutor; learners earn them by finishing the course) --

alter table public.courses
  add column skills text[] not null default '{}' check (cardinality(skills) <= 12);

-- Certificates ----------------------------------------------------------------
-- Issued by the server (service role) when a course is completed. Name and titles are snapshots so a
-- certificate never changes after it's issued. Anyone can verify one by its code via the server.

create table public.certificates (
  code text primary key check (code ~ '^[A-Z0-9]{8}$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  recipient_name text not null,
  course_title text not null,
  instructor_name text,
  issued_at timestamptz not null default now(),
  unique (user_id, course_id)
);

alter table public.certificates enable row level security;

create policy "users read own certificates"
  on public.certificates for select
  to authenticated
  using (user_id = auth.uid());

revoke all on public.certificates from anon, authenticated;
grant select on public.certificates to authenticated;

-- Saved courses -----------------------------------------------------------------

create table public.saved_courses (
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

alter table public.saved_courses enable row level security;

create policy "users manage own saved courses"
  on public.saved_courses for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Lesson notes + bookmarks ------------------------------------------------------------

create table public.lesson_notes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 10000),
  bookmarked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create trigger lesson_notes_updated_at
  before update on public.lesson_notes
  for each row execute function public.set_updated_at();

alter table public.lesson_notes enable row level security;

create policy "users manage own lesson notes"
  on public.lesson_notes for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
