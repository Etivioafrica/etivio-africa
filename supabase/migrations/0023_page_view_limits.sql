-- Etivio Africa: keep page-view tracking small.
-- 1. The same person opening the same page again within 10 minutes isn't saved again.
-- 2. Page views older than 90 days are deleted every night. Key events (sign-ups, enrolments,
--    lessons completed, publishing) are kept for good.

create or replace function public.skip_repeat_page_view()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'page_view' and exists (
    select 1 from public.activity_events
    where user_id = new.user_id
      and type = 'page_view'
      and path is not distinct from new.path
      and created_at > now() - interval '10 minutes'
  ) then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function public.skip_repeat_page_view() from public, anon, authenticated;

create trigger activity_events_skip_repeat_view
  before insert on public.activity_events
  for each row execute function public.skip_repeat_page_view();

create extension if not exists pg_cron;

select cron.schedule(
  'prune-old-page-views',
  '30 2 * * *',
  $$delete from public.activity_events where type = 'page_view' and created_at < now() - interval '90 days'$$
);
