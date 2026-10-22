-- Etivio Africa: admins can hide a published course from the marketplace (/explore) without unpublishing it. The
-- course page, Browse and existing enrolments are unaffected. Courses are listed by default.
alter table public.courses add column marketplace_listed boolean not null default true;
