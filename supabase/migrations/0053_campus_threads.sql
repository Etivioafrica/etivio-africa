-- Etivio Africa: threads on Campus (0051).
-- * thread: the posts that follow the first one, in order. Likes, replies and reposts stay on the first post.

alter table public.campus_posts
  add column thread text[] not null default '{}',
  add constraint campus_posts_thread_size check (cardinality(thread) <= 24);
