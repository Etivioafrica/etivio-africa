-- Etivio Africa: custom date ranges on the Tracking pages. Every report takes an optional end date, so "p_days
-- days ending on p_end" covers any range the admin picks. p_end defaults to today, so existing callers are unchanged.

drop function public.admin_daily_activity(integer);
drop function public.admin_active_users(integer);
drop function public.admin_top_pages(integer, integer);
drop function public.admin_top_courses(integer, integer);
drop function public.admin_traffic_report(integer);

create function public.admin_daily_activity(p_days integer default 30, p_end date default current_date)
returns table (day date, signups integer, enrollments integer, completions integer, page_views integer, active_users integer)
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select generate_series(p_end - (p_days - 1), p_end, interval '1 day')::date as day
  )
  select
    d.day,
    count(*) filter (where e.type = 'signup')::integer,
    count(*) filter (where e.type = 'enroll')::integer,
    count(*) filter (where e.type = 'lesson_complete')::integer,
    count(*) filter (where e.type = 'page_view')::integer,
    count(distinct e.user_id)::integer
  from days d
  left join public.activity_events e on e.created_at::date = d.day
  group by d.day
  order by d.day;
$$;

create function public.admin_active_users(p_days integer default 30, p_end date default current_date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct e.user_id)::integer
  from public.activity_events e
  where e.user_id is not null and e.created_at >= p_end - (p_days - 1) and e.created_at < p_end + 1;
$$;

create function public.admin_top_pages(p_days integer default 30, p_limit integer default 10, p_end date default current_date)
returns table (path text, views integer, visitors integer)
language sql
stable
security definer
set search_path = ''
as $$
  select e.path, count(*)::integer, count(distinct e.user_id)::integer
  from public.activity_events e
  where e.type = 'page_view' and e.path is not null and e.created_at >= p_end - (p_days - 1) and e.created_at < p_end + 1
  group by e.path
  order by 2 desc
  limit p_limit;
$$;

create function public.admin_top_courses(p_days integer default 30, p_limit integer default 10, p_end date default current_date)
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
  where e.type in ('enroll', 'lesson_complete') and e.created_at >= p_end - (p_days - 1) and e.created_at < p_end + 1
  group by c.id, c.title
  order by 3 desc, 4 desc
  limit p_limit;
$$;

create function public.admin_traffic_report(p_days integer default 30, p_end date default current_date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select * from public.visits where created_at >= p_end - (p_days - 1) and created_at < p_end + 1
  ),
  linked as (
    select distinct visitor_id, user_id from public.visits where user_id is not null
  ),
  first_touch as (
    select distinct on (p.id) p.id as user_id, f.landing_path, f.channel, f.country, f.device,
           coalesce(f.utm_source, f.referrer_host) as source
    from public.profiles p
    join linked l on l.user_id = p.id
    join public.visits f on f.visitor_id = l.visitor_id
    where p.created_at >= p_end - (p_days - 1) and p.created_at < p_end + 1
    order by p.id, f.created_at
  ),
  days as (
    select generate_series(p_end - (p_days - 1), p_end, interval '1 day')::date as day
  )
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'visits', count(*),
        'visitors', count(distinct visitor_id),
        'pages', coalesce(sum(pages), 0),
        'bounces', count(*) filter (where pages = 1),
        'signups', (select count(*) from first_touch)
      ) from v
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'visits', (select count(*) from v where v.created_at::date = d.day)) order by d.day), '[]')
      from days d
    ),
    'landing', (
      select coalesce(jsonb_agg(t order by t.visits desc), '[]') from (
        select landing_path as key, count(*) as visits, count(distinct visitor_id) as visitors,
               count(*) filter (where pages = 1) as bounces,
               (select count(*) from first_touch ft where ft.landing_path = v.landing_path) as signups
        from v group by landing_path order by count(*) desc limit 20
      ) t
    ),
    'channels', (
      select coalesce(jsonb_agg(t order by t.visits desc), '[]') from (
        select channel as key, count(*) as visits, count(distinct visitor_id) as visitors,
               count(*) filter (where pages = 1) as bounces,
               (select count(*) from first_touch ft where ft.channel = v.channel) as signups
        from v group by channel
      ) t
    ),
    'sources', (
      select coalesce(jsonb_agg(t order by t.visits desc), '[]') from (
        select g.*, coalesce(f.n, 0) as signups from (
          select coalesce(utm_source, referrer_host) as key, count(*) as visits, count(distinct visitor_id) as visitors,
                 count(*) filter (where pages = 1) as bounces
          from v where coalesce(utm_source, referrer_host) is not null
          group by 1 order by count(*) desc limit 15
        ) g left join (select source as key, count(*) as n from first_touch group by 1) f using (key)
      ) t
    ),
    'campaigns', (
      select coalesce(jsonb_agg(t order by t.visits desc), '[]') from (
        select utm_campaign as key, count(*) as visits, count(distinct visitor_id) as visitors,
               count(*) filter (where pages = 1) as bounces, 0 as signups
        from v where utm_campaign is not null
        group by utm_campaign order by count(*) desc limit 15
      ) t
    ),
    'countries', (
      select coalesce(jsonb_agg(t order by t.visits desc), '[]') from (
        select g.*, coalesce(f.n, 0) as signups from (
          select coalesce(country, '??') as key, count(*) as visits, count(distinct visitor_id) as visitors,
                 count(*) filter (where pages = 1) as bounces
          from v group by 1 order by count(*) desc limit 15
        ) g left join (select coalesce(country, '??') as key, count(*) as n from first_touch group by 1) f using (key)
      ) t
    ),
    'cities', (
      select coalesce(jsonb_agg(t order by t.visits desc), '[]') from (
        select city || coalesce(', ' || country, '') as key, count(*) as visits, count(distinct visitor_id) as visitors,
               count(*) filter (where pages = 1) as bounces, 0 as signups
        from v where city is not null
        group by city, country order by count(*) desc limit 15
      ) t
    ),
    'devices', (
      select coalesce(jsonb_agg(t order by t.visits desc), '[]') from (
        select g.*, coalesce(f.n, 0) as signups from (
          select coalesce(device, 'Unknown') as key, count(*) as visits, count(distinct visitor_id) as visitors,
                 count(*) filter (where pages = 1) as bounces
          from v group by 1
        ) g left join (select coalesce(device, 'Unknown') as key, count(*) as n from first_touch group by 1) f using (key)
      ) t
    )
  );
$$;

revoke all on function public.admin_daily_activity(integer, date) from public, anon, authenticated;
revoke all on function public.admin_active_users(integer, date) from public, anon, authenticated;
revoke all on function public.admin_top_pages(integer, integer, date) from public, anon, authenticated;
revoke all on function public.admin_top_courses(integer, integer, date) from public, anon, authenticated;
revoke all on function public.admin_traffic_report(integer, date) from public, anon, authenticated;
grant execute on function public.admin_daily_activity(integer, date) to service_role;
grant execute on function public.admin_active_users(integer, date) to service_role;
grant execute on function public.admin_top_pages(integer, integer, date) to service_role;
grant execute on function public.admin_top_courses(integer, integer, date) to service_role;
grant execute on function public.admin_traffic_report(integer, date) to service_role;
