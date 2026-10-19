-- Etivio Africa: Coursera-style lessons. Each lesson is a video or a reading (both can carry rich text),
-- and can have downloadable resources attached. Resources reuse the documents table, scoped to a lesson.

alter table public.lessons
  add column kind text not null default 'video' check (kind in ('video', 'reading'));

-- Lessons that already have text but no video read better as readings.
update public.lessons set kind = 'reading' where video_url is null and content is not null and content <> '';

alter table public.documents
  add column lesson_id uuid references public.lessons (id) on delete cascade;

create index documents_lesson_idx on public.documents (lesson_id) where lesson_id is not null;
