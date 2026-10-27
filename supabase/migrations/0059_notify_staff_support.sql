-- Tell the team when a learner writes to support: the admin the chat is assigned to, or every super admin when
-- nobody has picked it up yet.
create or replace function public.notify_staff_support()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  t record;
  who text;
begin
  if new.is_staff then return new; end if;
  select id, subject, assigned_to, user_id into t from public.support_threads where id = new.thread_id;
  select coalesce(nullif(full_name, ''), 'A learner') into who from public.profiles where id = t.user_id;
  if t.assigned_to is not null then
    perform public.notify(t.assigned_to, 'support', who || ' wrote to support', new.body, '/admin/chats/' || t.id);
  else
    perform public.notify(r.user_id, 'support', who || ' wrote to support', new.body, '/admin/chats/' || t.id)
      from public.user_roles r where r.role = 'super_admin';
  end if;
  return new;
end;
$$;
create trigger support_messages_notify_staff after insert on public.support_messages
  for each row execute function public.notify_staff_support();
