-- Etivio Africa: earned badges with when they were earned and whether the learner has seen the celebration.
-- Badges are granted by the server (service role) from real progress; learners can only mark them seen.

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id text not null check (badge_id in (
    'early', 'first_lesson', 'lessons_25', 'finisher', 'streak_7', 'lessons_100', 'graduate', 'streak_30', 'tutor'
  )),
  earned_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (user_id, badge_id)
);

create index user_badges_unseen_idx on public.user_badges (user_id) where seen_at is null;

alter table public.user_badges enable row level security;

create policy "users read own badges"
  on public.user_badges for select
  to authenticated
  using (user_id = auth.uid());

create policy "users mark own badges seen"
  on public.user_badges for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.user_badges from anon, authenticated;
grant select on public.user_badges to authenticated;
grant update (seen_at) on public.user_badges to authenticated;
