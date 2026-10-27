-- Etivio Africa: learner guides (0054).
-- * guide_state: where each learner is with the in-app guides. Keys: tour (when they finished or skipped the
--   spotlight tour), checklist_hidden (closed the getting-started card), tips (page tips they've dismissed).
--   Read and written by the server with the service role only, so no column grants for clients.

alter table public.profiles
  add column guide_state jsonb not null default '{}'::jsonb;
