-- In-app notifications (the bell in the header). Written only by the triggers below; people read and mark their own.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mark own notifications read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_href text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, href)
  select p_user, p_kind, p_title, left(p_body, 200), p_href
  where p_user is not null;
$$;
revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;

-- Support replied.
create or replace function public.notify_support_reply()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_staff then
    perform public.notify(t.user_id, 'support', 'Etivio support replied', new.body, '/support/' || t.id)
      from public.support_threads t where t.id = new.thread_id;
  end if;
  return new;
end;
$$;
create trigger support_messages_notify after insert on public.support_messages
  for each row execute function public.notify_support_reply();

-- A tutor or student wrote in a course conversation.
create or replace function public.notify_course_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c record;
  sender text;
begin
  if new.hidden then return new; end if;
  select * into c from public.conversations where id = new.conversation_id;
  select coalesce(nullif(full_name, ''), 'Someone') into sender from public.profiles where id = new.sender_id;
  if new.sender_id = c.tutor_id then
    perform public.notify(c.student_id, 'message', sender || ' sent you a message', new.body, '/learn/messages/' || c.id);
  elsif new.sender_id = c.student_id then
    perform public.notify(c.tutor_id, 'message', sender || ' sent you a message', new.body, '/teach/messages/' || c.id);
  end if;
  return new;
end;
$$;
create trigger conversation_messages_notify after insert on public.conversation_messages
  for each row execute function public.notify_course_message();

-- Earned a badge.
create or replace function public.notify_badge()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify(new.user_id, 'badge', 'You earned a new badge', 'See it with the rest of your badges.', '/profile/badges');
  return new;
end;
$$;
create trigger user_badges_notify after insert on public.user_badges
  for each row execute function public.notify_badge();

-- Certificate issued.
create or replace function public.notify_certificate()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify(new.user_id, 'certificate', 'Your certificate is ready', new.course_title, '/certificate/' || new.code);
  return new;
end;
$$;
create trigger certificates_notify after insert on public.certificates
  for each row execute function public.notify_certificate();

-- Community join requests: tell the owner about a new request, and the person when they're let in.
create or replace function public.notify_community_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cm record;
begin
  select id, name, slug, owner_id into cm from public.communities where id = new.community_id;
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.notify(cm.owner_id, 'community', 'New request to join ' || cm.name, 'Someone is waiting for you to let them in.', '/communities/' || cm.slug);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'active' then
    perform public.notify(new.user_id, 'community', 'You''re in ' || cm.name, 'Your request to join was approved.', '/communities/' || cm.slug);
  end if;
  return new;
end;
$$;
create trigger community_members_notify after insert or update of status on public.community_members
  for each row execute function public.notify_community_member();

-- Live updates for the bell and the messages menu.
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.conversations;
