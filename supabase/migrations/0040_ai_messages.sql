-- Etivio Africa: AI features. Every AI exchange is kept here: learners see their own lesson chat history, daily
-- limits are counted from it, and admins can see usage. Only the server writes (service role).
create table public.ai_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  -- lesson_chat (learners), course_writer (tutors), thumbnail (tutors)
  feature text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 12000),
  created_at timestamptz not null default now()
);

create index ai_messages_thread_idx on public.ai_messages (user_id, course_id, created_at);
create index ai_messages_usage_idx on public.ai_messages (user_id, feature, created_at) where role = 'user';

alter table public.ai_messages enable row level security;
create policy "people read their own AI messages" on public.ai_messages for select to authenticated using (user_id = auth.uid());
revoke all on public.ai_messages from anon, authenticated;
grant select on public.ai_messages to authenticated;
