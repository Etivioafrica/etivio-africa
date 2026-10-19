-- Etivio Africa: answers from the new-learner welcome guide.
-- `onboarded_at` is set when the guide is finished or skipped, so it only shows once.

alter table public.profiles
  add column learning_goal text check (learning_goal in ('new_skill', 'career', 'creative', 'freelance', 'job')),
  add column skill_level text check (skill_level in ('beginner', 'intermediate', 'advanced', 'expert')),
  add column weekly_hours text check (weekly_hours in ('under_3', '3_to_6', 'over_6')),
  add column onboarded_at timestamptz;

grant update (learning_goal, skill_level, weekly_hours, onboarded_at) on public.profiles to authenticated;
