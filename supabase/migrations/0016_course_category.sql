-- Etivio Africa: course category, from the same topic list learners pick in the welcome guide,
-- so recommendations can match courses to what each learner wants.

alter table public.courses
  add column category text check (category in (
    'Design', 'Development', 'Marketing', 'Business', 'Data & AI', 'Product',
    'Content creation', 'Finance', 'Photography & video', 'Writing', 'Sales', 'Personal growth'
  ));

create index courses_category_idx on public.courses (category) where status = 'published';
