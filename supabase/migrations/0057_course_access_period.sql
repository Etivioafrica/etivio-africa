-- Courses can be sold for a set time instead of for life. access_days null = lifetime.
alter table public.courses
  add column access_days integer check (access_days is null or access_days between 1 and 3650);

-- When this learner's access ends. Null = lifetime (and every enrolment made before this change).
alter table public.enrollments
  add column expires_at timestamptz;

-- New enrolments get their end date from the course's access period at the time they join.
create or replace function public.set_enrollment_expiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.expires_at is null then
    select case when c.access_days is null then null else new.enrolled_at + make_interval(days => c.access_days) end
      into new.expires_at
      from public.courses c where c.id = new.course_id;
  end if;
  return new;
end;
$$;

create trigger enrollments_set_expiry
  before insert on public.enrollments
  for each row execute function public.set_enrollment_expiry();

-- Buying again after access ended starts a fresh period from now.
create or replace function public.renew_enrollments(p_user_id uuid, p_course_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.enrollments e
     set expires_at = case when c.access_days is null then null else now() + make_interval(days => c.access_days) end
    from public.courses c
   where c.id = e.course_id
     and e.user_id = p_user_id
     and e.course_id = any (p_course_ids)
     and e.expires_at is not null
     and e.expires_at <= now();
$$;
revoke execute on function public.renew_enrollments(uuid, uuid[]) from public, anon, authenticated;

-- Expired access no longer counts as enrolled (lesson content, progress, quizzes).
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
      and (expires_at is null or expires_at > now())
  );
$$;
