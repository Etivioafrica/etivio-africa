-- Learners can pick more than one goal in the welcome guide. learning_goal now holds a comma-separated list
-- of the same keys (e.g. 'career,job'); old single values still pass.
alter table public.profiles drop constraint if exists profiles_learning_goal_check;
alter table public.profiles add constraint profiles_learning_goal_check
  check (learning_goal ~ '^(new_skill|career|creative|freelance|job)(,(new_skill|career|creative|freelance|job))*$');
