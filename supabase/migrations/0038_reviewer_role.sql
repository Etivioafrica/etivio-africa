-- Etivio Africa: a Reviewer staff role and two course review statuses. Kept apart from 0039 because Postgres can't
-- use a new enum value in the same transaction that adds it.
alter type public.app_role add value if not exists 'reviewer';
alter type public.course_status add value if not exists 'pending' after 'draft';
alter type public.course_status add value if not exists 'rejected' after 'published';
