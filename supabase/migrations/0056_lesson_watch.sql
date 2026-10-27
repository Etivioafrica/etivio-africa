-- How much of each video lesson a learner has actually played. Written only by the server (reportLessonWatch),
-- which caps each report by the real time since the last one, so skipping ahead or faking calls can't fill it.
create table public.lesson_watch (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  -- Watched enough (90% of the video) to mark the lesson complete.
  qualified boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.lesson_watch enable row level security;

create policy "read own watch time"
  on public.lesson_watch for select
  to authenticated
  using (user_id = auth.uid());

-- Video lessons can only be marked complete once enough of the video has been watched.
drop policy "record own progress when enrolled" on public.lesson_progress;
create policy "record own progress when enrolled"
  on public.lesson_progress for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.lessons l
      where l.id = lesson_id
        and public.is_enrolled(l.course_id)
        and (
          coalesce(l.video_url, '') = ''
          or exists (select 1 from public.lesson_watch w where w.user_id = auth.uid() and w.lesson_id = l.id and w.qualified)
        )
    )
  );
