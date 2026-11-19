-- Communities upgrade: a picture and a category on posts, "edited" marks, community rules, and in-app
-- notifications (a reply on your post, a new join request, your request approved).
-- Notifications are written by triggers through public.notify (0058), like the other bell notifications.

alter table public.community_posts
  add column image_url text,
  add column category text not null default 'discussion' check (category in ('discussion', 'question', 'win', 'resource')),
  add column edited_at timestamptz;
alter table public.community_comments add column edited_at timestamptz;
alter table public.communities add column rules text check (length(rules) <= 2000);

-- The feed filters by category.
create index community_posts_category_idx on public.community_posts (community_id, category, created_at desc);

-- Someone replied on your post (not for your own comments, and not while the comment is held for a check).
create or replace function public.notify_community_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  p record;
  who text;
begin
  if new.hidden then return new; end if;
  select cp.author_id, c.slug, c.name into p
    from public.community_posts cp join public.communities c on c.id = cp.community_id
   where cp.id = new.post_id;
  if p.author_id is null or p.author_id = new.author_id then return new; end if;
  select coalesce(nullif(full_name, ''), 'Someone') into who from public.profiles where id = new.author_id;
  perform public.notify(p.author_id, 'community', who || ' replied to your post in ' || p.name, new.body, '/communities/' || p.slug);
  return new;
end;
$$;
create trigger community_comments_notify after insert on public.community_comments
  for each row execute function public.notify_community_comment();

-- A join request needs a moderator: tell the owner. An approved request tells the person who asked.
create or replace function public.notify_community_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c record;
  who text;
begin
  select slug, name, owner_id into c from public.communities where id = new.community_id;
  if tg_op = 'INSERT' and new.status = 'pending' then
    select coalesce(nullif(full_name, ''), 'Someone') into who from public.profiles where id = new.user_id;
    perform public.notify(c.owner_id, 'community', who || ' asked to join ' || c.name, new.answer, '/communities/' || c.slug);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'active' then
    perform public.notify(new.user_id, 'community', 'You''re in: ' || c.name, 'Your request to join was approved.', '/communities/' || c.slug);
  end if;
  return new;
end;
$$;
create trigger community_members_notify after insert or update of status on public.community_members
  for each row execute function public.notify_community_member();
