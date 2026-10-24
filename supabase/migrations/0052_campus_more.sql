-- Etivio Africa: more from the old In-House feed on Campus (0051).
-- * link: the preview card for the first web link in a post ({url, title, description, image, site}).
-- * job: details on an Opportunity post ({pay, salary, title, company, location, remote, type, email, url}).
-- * repost_of: a plain repost (no words of its own). It goes when the original goes, and each person reposts a post once.

alter table public.campus_posts
  add column link jsonb,
  add column job jsonb,
  add column repost_of uuid references public.campus_posts (id) on delete cascade,
  add column repost_count integer not null default 0;

create unique index campus_reposts_once on public.campus_posts (author_id, repost_of) where repost_of is not null;
create index campus_reposts_idx on public.campus_posts (repost_of) where repost_of is not null;

create or replace function public.campus_repost_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.campus_posts
    set repost_count = greatest(0, repost_count + case when tg_op = 'INSERT' then 1 else -1 end)
    where id = coalesce(new.repost_of, old.repost_of);
  return null;
end;
$$;
revoke all on function public.campus_repost_counts() from public, anon, authenticated;
create trigger campus_reposts_added after insert on public.campus_posts for each row when (new.repost_of is not null) execute function public.campus_repost_counts();
create trigger campus_reposts_removed after delete on public.campus_posts for each row when (old.repost_of is not null) execute function public.campus_repost_counts();
