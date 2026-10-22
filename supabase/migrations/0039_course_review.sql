-- Etivio Africa: every tutor course is reviewed before it first goes live. Tutors submit (status 'pending'); a
-- reviewer approves (published) or asks for changes (rejected, with a note). Once a course has been approved,
-- the tutor can edit it, unpublish and republish it freely. Trusted tutors skip the queue.
-- Admin and reviewer actions run on the server with the service role, so the guard below only limits tutors.

alter table public.courses
  add column review_note text check (char_length(review_note) <= 1000),
  add column submitted_at timestamptz,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.profiles (id) on delete set null;

-- Set by a super admin only (profiles columns are granted to users one by one, and this one isn't).
alter table public.profiles add column trusted_tutor boolean not null default false;

create index courses_review_queue_idx on public.courses (submitted_at) where status = 'pending';

create or replace function public.guard_course_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trusted boolean;
begin
  -- Service role (no signed-in user) and super admins aren't limited.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  select coalesce(trusted_tutor, false) into v_trusted from public.profiles where id = auth.uid();

  if tg_op = 'INSERT' then
    new.status := case when new.status = 'pending' then 'pending'::public.course_status
                       when new.status = 'published' and v_trusted then 'published'::public.course_status
                       else 'draft'::public.course_status end;
    new.featured := false;
    new.marketplace_listed := true;
    new.review_note := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.submitted_at := case when new.status = 'pending' then now() end;
    new.published_at := case when new.status = 'published' then now() end;
    return new;
  end if;

  -- Fields only staff set.
  new.featured := old.featured;
  new.marketplace_listed := old.marketplace_listed;
  new.review_note := old.review_note;
  new.reviewed_at := old.reviewed_at;
  new.reviewed_by := old.reviewed_by;
  new.submitted_at := old.submitted_at;
  new.published_at := old.published_at;

  if new.status is distinct from old.status then
    if new.status = 'pending' then
      if old.status not in ('draft', 'rejected') then
        raise exception 'Only drafts or courses with requested changes can be submitted for review.';
      end if;
      new.submitted_at := now();
    elsif new.status = 'published' then
      -- Approved once before, or a trusted tutor: no review needed.
      if old.published_at is null and not v_trusted then
        raise exception 'This course needs to be approved by Etivio before it goes live. Submit it for review.';
      end if;
      if old.published_at is null then
        new.published_at := now();
      end if;
    elsif new.status = 'rejected' then
      raise exception 'Only reviewers can request changes.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_course_review() from public, anon, authenticated;

create trigger courses_guard_review
  before insert or update on public.courses
  for each row execute function public.guard_course_review();

-- Courses already live count as approved. Published courses always have published_at; this is a safety net.
update public.courses set published_at = coalesce(published_at, updated_at) where status = 'published';
