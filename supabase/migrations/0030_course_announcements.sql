-- Announcements can target one course. Platform-wide ones keep course_id null.
alter table public.announcements add column course_id uuid references public.courses(id) on delete cascade;
create index announcements_course_id_idx on public.announcements(course_id) where course_id is not null;

-- Course announcements are only visible to learners enrolled in that course and to its tutor.
-- (Staff manage announcements through the service role, so they don't need a policy here.)
drop policy "learners read live announcements" on public.announcements;
create policy "learners read live announcements"
  on public.announcements for select
  to authenticated
  using (
    (status = 'published' or (status = 'scheduled' and scheduled_at <= now()))
    and (
      course_id is null
      or exists (select 1 from public.enrollments e where e.course_id = announcements.course_id and e.user_id = (select auth.uid()))
      or exists (select 1 from public.courses c where c.id = announcements.course_id and c.instructor_id = (select auth.uid()))
    )
  );
