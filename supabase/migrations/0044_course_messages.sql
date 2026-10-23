-- Etivio Africa: private messages between a student and the tutor of a course they're enrolled in.
-- One conversation per student per course. The server checks enrolment before anything is written; RLS lets each
-- side read only their own conversations (and Realtime uses the same rules to push new messages).

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  last_message text,
  last_message_at timestamptz not null default now(),
  -- Messages the other side hasn't opened yet.
  student_unread integer not null default 0,
  tutor_unread integer not null default 0,
  created_at timestamptz not null default now(),
  unique (course_id, student_id)
);
create index conversations_tutor_idx on public.conversations (tutor_id, last_message_at desc);
create index conversations_student_idx on public.conversations (student_id, last_message_at desc);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index conversation_messages_idx on public.conversation_messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
create policy "people see their own conversations" on public.conversations for select to authenticated
  using (student_id = (select auth.uid()) or tutor_id = (select auth.uid()));
create policy "people see messages in their conversations" on public.conversation_messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and (c.student_id = (select auth.uid()) or c.tutor_id = (select auth.uid()))));
revoke all on public.conversations, public.conversation_messages from anon, authenticated;
grant select on public.conversations, public.conversation_messages to authenticated;

-- Each new message updates the conversation preview and the other side's unread count.
create or replace function public.on_conversation_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations c
     set last_message = left(new.body, 140),
         last_message_at = new.created_at,
         student_unread = case when new.sender_id = c.tutor_id then c.student_unread + 1 else c.student_unread end,
         tutor_unread = case when new.sender_id = c.student_id then c.tutor_unread + 1 else c.tutor_unread end
   where c.id = new.conversation_id;
  return new;
end;
$$;
revoke all on function public.on_conversation_message() from public, anon, authenticated;
create trigger conversation_message_added after insert on public.conversation_messages for each row execute function public.on_conversation_message();

alter publication supabase_realtime add table public.conversation_messages;
