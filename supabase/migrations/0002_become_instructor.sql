-- Teaching is open to every user: a student can upgrade themselves to instructor.
-- Roles stay locked against direct updates, so this is the only self-service path.

create or replace function public.become_instructor()
returns public.user_role
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role public.user_role;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.profiles
  set role = 'instructor'
  where id = auth.uid() and role = 'student';

  select role into current_role from public.profiles where id = auth.uid();
  return current_role;
end;
$$;

revoke execute on function public.become_instructor() from public, anon;
grant execute on function public.become_instructor() to authenticated;

-- Lesson counts per published course, so catalog and progress bars work
-- without exposing lesson content to people who aren't enrolled.
create or replace function public.course_lesson_counts(p_course_ids uuid[])
returns table (course_id uuid, lesson_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select l.course_id, count(*)::integer
  from public.lessons l
  join public.courses c on c.id = l.course_id
  where l.course_id = any (p_course_ids)
    and (c.status = 'published' or c.instructor_id = auth.uid())
  group by l.course_id;
$$;

grant execute on function public.course_lesson_counts(uuid[]) to anon, authenticated;
