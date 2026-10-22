-- Etivio Africa: where visitors land and where they come from. One row per visit (a browsing session that ends
-- after 30 minutes of inactivity), signed in or not. Written only by /api/t through track_visit() with the service
-- role; read only by the admin Traffic page.

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null,
  user_id uuid references public.profiles (id) on delete set null,
  landing_path text not null,
  last_path text,
  referrer text,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  channel text not null default 'Direct',
  country text,
  region text,
  city text,
  device text,
  browser text,
  os text,
  pages integer not null default 1,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index visits_created_idx on public.visits (created_at desc);
create index visits_visitor_idx on public.visits (visitor_id, created_at);
create index visits_user_idx on public.visits (user_id) where user_id is not null;

alter table public.visits enable row level security;
revoke all on public.visits from anon, authenticated;

-- Records one page hit. Continues the visit when it's the same visitor within 30 minutes (and no new campaign
-- link was opened), otherwise starts a new one. Returns the visit id the caller keeps in a cookie.
create or replace function public.track_visit(
  p_visit_id uuid,
  p_visitor_id uuid,
  p_user_id uuid,
  p_path text,
  p_new_campaign boolean,
  p_referrer text,
  p_referrer_host text,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text,
  p_utm_term text,
  p_utm_content text,
  p_channel text,
  p_country text,
  p_region text,
  p_city text,
  p_device text,
  p_browser text,
  p_os text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_visit_id is not null and not p_new_campaign then
    update public.visits
       set pages = pages + 1,
           last_path = p_path,
           last_seen_at = now(),
           user_id = coalesce(user_id, p_user_id)
     where id = p_visit_id
       and visitor_id = p_visitor_id
       and last_seen_at > now() - interval '30 minutes'
    returning id into v_id;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.visits (
    visitor_id, user_id, landing_path, last_path, referrer, referrer_host, utm_source, utm_medium, utm_campaign,
    utm_term, utm_content, channel, country, region, city, device, browser, os
  ) values (
    p_visitor_id, p_user_id, p_path, p_path, p_referrer, p_referrer_host, p_utm_source, p_utm_medium, p_utm_campaign,
    p_utm_term, p_utm_content, p_channel, p_country, p_region, p_city, p_device, p_browser, p_os
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.track_visit(uuid, uuid, uuid, text, boolean, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.track_visit(uuid, uuid, uuid, text, boolean, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to service_role;

-- Everything the Traffic page shows for the last p_days days, as one JSON document. Sign-ups are credited to the
-- person's first visit ever (first touch), found through any visitor id that was ever signed in as them.
create or replace function public.admin_traffic_report(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select * from public.visits where created_at >= current_date - (p_days - 1)
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
    where p.created_at >= current_date - (p_days - 1)
    order by p.id, f.created_at
  ),
  days as (
    select generate_series(current_date - (p_days - 1), current_date, interval '1 day')::date as day
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

revoke all on function public.admin_traffic_report(integer) from public, anon, authenticated;
grant execute on function public.admin_traffic_report(integer) to service_role;

-- Visits are kept for 13 months, enough for year-on-year comparison.
select cron.schedule(
  'prune-old-visits',
  '45 2 * * *',
  $$delete from public.visits where created_at < now() - interval '13 months'$$
);
