-- Instructors can see lesson progress for students in their own courses.
create policy "course owners read student progress"
  on public.lesson_progress for select
  to authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_id and (public.owns_course(l.course_id) or public.is_admin())
    )
  );
