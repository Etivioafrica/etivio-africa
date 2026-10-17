-- Tracking summaries for the admin dashboard (service role only).

create or replace function public.admin_active_users(p_days integer default 30)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct user_id)::integer
  from public.activity_events
  where user_id is not null and created_at >= current_date - (p_days - 1);
$$;

create or replace function public.admin_top_pages(p_days integer default 30, p_limit integer default 10)
returns table (path text, views integer, visitors integer)
language sql
stable
security definer
set search_path = ''
as $$
  select e.path, count(*)::integer, count(distinct e.user_id)::integer
  from public.activity_events e
  where e.type = 'page_view' and e.path is not null and e.created_at >= current_date - (p_days - 1)
  group by e.path
  order by 2 desc
  limit p_limit;
$$;

create or replace function public.admin_top_courses(p_days integer default 30, p_limit integer default 10)
returns table (course_id uuid, title text, enrollments integer, completions integer, learners integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.title,
    count(*) filter (where e.type = 'enroll')::integer,
    count(*) filter (where e.type = 'lesson_complete')::integer,
    count(distinct e.user_id)::integer
  from public.activity_events e
  join public.courses c on c.id = e.course_id
  where e.type in ('enroll', 'lesson_complete') and e.created_at >= current_date - (p_days - 1)
  group by c.id, c.title
  order by 3 desc, 4 desc
  limit p_limit;
$$;

revoke execute on function public.admin_active_users(integer) from public, anon, authenticated;
revoke execute on function public.admin_top_pages(integer, integer) from public, anon, authenticated;
revoke execute on function public.admin_top_courses(integer, integer) from public, anon, authenticated;
grant execute on function public.admin_active_users(integer) to service_role;
grant execute on function public.admin_top_pages(integer, integer) to service_role;
grant execute on function public.admin_top_courses(integer, integer) to service_role;
