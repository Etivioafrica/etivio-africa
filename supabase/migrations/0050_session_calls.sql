-- Etivio Africa: video calls for coaching sessions, built in (no outside meeting links). Each booked session has a
-- call room. Audio and video go straight between the learner and the coach (WebRTC); the connection messages travel
-- over a private Supabase Realtime channel named "session:<booking id>", which only those two people can use.
-- The first time each of them joins is recorded, so attendance is clear if a session is disputed.

alter table public.coach_bookings
  add column learner_joined_at timestamptz,
  add column coach_joined_at timestamptz;

-- Can the signed-in person use this Realtime topic? Only "session:<id>" for a booked session they're part of.
create or replace function public.can_use_session_channel(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_topic ~ '^session:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (
       select 1 from public.coach_bookings b
        where b.id = substring(p_topic from 9)::uuid
          and b.status = 'confirmed'
          and (select auth.uid()) in (b.learner_id, b.coach_id)
     );
$$;
revoke all on function public.can_use_session_channel(text) from public, anon;
grant execute on function public.can_use_session_channel(text) to authenticated;

create policy "session members receive call messages" on realtime.messages for select to authenticated
  using (public.can_use_session_channel((select realtime.topic())));
create policy "session members send call messages" on realtime.messages for insert to authenticated
  with check (public.can_use_session_channel((select realtime.topic())));
