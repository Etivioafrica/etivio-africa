-- Etivio Africa: admin platform
-- account status, blog, documents, support inbox, activity tracking, payments + payouts, settings, audit log.
-- Admin pages write through the service role after an explicit role check in the server action.
-- RLS here covers what students, instructors, and the admin realtime inbox read directly.

-- Account status ---------------------------------------------------------

create type public.account_status as enum ('active', 'suspended');

alter table public.profiles
  add column status public.account_status not null default 'active',
  add column last_seen_at timestamptz;

-- Roles ----------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin') and status = 'active'
  );
$$;

create or replace function public.is_instructor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('instructor', 'admin', 'super_admin')
  );
$$;

-- Blog -----------------------------------------------------------------

create type public.post_status as enum ('draft', 'published');

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles (id) on delete set null,
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  cover_url text,
  tags text[] not null default '{}',
  status public.post_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blog_posts_status_idx on public.blog_posts (status, published_at desc);

create trigger blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

alter table public.blog_posts enable row level security;

create policy "published posts are readable by everyone"
  on public.blog_posts for select
  using (status = 'published' or public.is_admin());

-- Documents (resource library) ------------------------------------------

create type public.document_visibility as enum ('public', 'enrolled', 'private');

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  file_url text not null,
  file_key text,
  file_name text,
  file_size bigint,
  mime_type text,
  course_id uuid references public.courses (id) on delete set null,
  visibility public.document_visibility not null default 'enrolled',
  uploaded_by uuid references public.profiles (id) on delete set null,
  download_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_course_idx on public.documents (course_id);

create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

alter table public.documents enable row level security;

-- Public docs for everyone; course docs for enrolled students and the course owner.
create policy "documents readable by audience"
  on public.documents for select
  using (
    visibility = 'public'
    or (visibility = 'enrolled' and course_id is not null and (public.is_enrolled(course_id) or public.owns_course(course_id)))
    or public.is_admin()
  );

-- Support inbox ----------------------------------------------------------

create type public.thread_status as enum ('open', 'pending', 'closed');

create table public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  status public.thread_status not null default 'open',
  assigned_to uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz not null default now(),
  user_unread boolean not null default false,
  staff_unread boolean not null default true,
  created_at timestamptz not null default now()
);

create index support_threads_user_idx on public.support_threads (user_id, last_message_at desc);
create index support_threads_status_idx on public.support_threads (status, last_message_at desc);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  is_staff boolean not null default false,
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index support_messages_thread_idx on public.support_messages (thread_id, created_at);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

create policy "users read own threads, staff read all"
  on public.support_threads for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "users open their own threads"
  on public.support_threads for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'open');

create policy "read messages of visible threads"
  on public.support_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.support_threads t
      where t.id = thread_id and (t.user_id = auth.uid() or public.is_admin())
    )
  );

-- Users post into their own threads as themselves, never as staff.
create policy "users post in own threads"
  on public.support_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and is_staff = false
    and exists (
      select 1 from public.support_threads t
      where t.id = thread_id and t.user_id = auth.uid() and t.status <> 'closed'
    )
  );

-- Keep thread ordering + unread flags in sync with new messages.
create or replace function public.support_message_bump()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.support_threads
  set last_message_at = new.created_at,
      staff_unread = case when new.is_staff then staff_unread else true end,
      user_unread = case when new.is_staff then true else user_unread end,
      status = case when new.is_staff then 'pending'::public.thread_status
                    when status = 'pending' then 'open'::public.thread_status
                    else status end
  where id = new.thread_id;
  return new;
end;
$$;

create trigger support_messages_bump
  after insert on public.support_messages
  for each row execute function public.support_message_bump();

-- Users may only clear their own unread flag.
create or replace function public.mark_thread_read(p_thread_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.support_threads set user_unread = false
  where id = p_thread_id and user_id = auth.uid();
$$;

revoke execute on function public.mark_thread_read(uuid) from public, anon;
grant execute on function public.mark_thread_read(uuid) to authenticated;

alter publication supabase_realtime add table public.support_messages, public.support_threads;

-- Activity tracking -------------------------------------------------------

create table public.activity_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  type text not null,
  path text,
  course_id uuid references public.courses (id) on delete set null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index activity_events_created_idx on public.activity_events (created_at desc);
create index activity_events_type_idx on public.activity_events (type, created_at desc);
create index activity_events_user_idx on public.activity_events (user_id, created_at desc);

alter table public.activity_events enable row level security;

-- Signed-in users can only log page views as themselves. Everything else is written by triggers.
create policy "users log own page views"
  on public.activity_events for insert
  to authenticated
  with check (user_id = auth.uid() and type = 'page_view');

create or replace function public.track_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activity_events (user_id, type) values (new.id, 'signup');
  return new;
end;
$$;

create trigger profiles_track_signup
  after insert on public.profiles
  for each row execute function public.track_signup();

create or replace function public.track_enrollment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activity_events (user_id, type, course_id) values (new.user_id, 'enroll', new.course_id);
  return new;
end;
$$;

create trigger enrollments_track
  after insert on public.enrollments
  for each row execute function public.track_enrollment();

create or replace function public.track_lesson_complete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activity_events (user_id, type, course_id, meta)
  select new.user_id, 'lesson_complete', l.course_id, jsonb_build_object('lesson_id', new.lesson_id)
  from public.lessons l where l.id = new.lesson_id;
  return new;
end;
$$;

create trigger lesson_progress_track
  after insert on public.lesson_progress
  for each row execute function public.track_lesson_complete();

create or replace function public.track_course_publish()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    insert into public.activity_events (user_id, type, course_id) values (new.instructor_id, 'course_published', new.id);
  end if;
  return new;
end;
$$;

create trigger courses_track_publish
  after update of status on public.courses
  for each row execute function public.track_course_publish();

-- Backfill history so tracking isn't empty on day one.
insert into public.activity_events (user_id, type, created_at)
  select id, 'signup', created_at from public.profiles;
insert into public.activity_events (user_id, type, course_id, created_at)
  select user_id, 'enroll', course_id, enrolled_at from public.enrollments;
insert into public.activity_events (user_id, type, course_id, meta, created_at)
  select p.user_id, 'lesson_complete', l.course_id, jsonb_build_object('lesson_id', p.lesson_id), p.completed_at
  from public.lesson_progress p join public.lessons l on l.id = p.lesson_id;

-- Payments + payouts --------------------------------------------------------

create type public.payment_status as enum ('pending', 'success', 'failed', 'refunded');
create type public.payout_status as enum ('pending', 'paid', 'cancelled');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  course_id uuid references public.courses (id) on delete set null,
  instructor_id uuid references public.profiles (id) on delete set null,
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null default 'NGN',
  -- Split fixed at payment time so later commission changes don't rewrite history.
  platform_fee_minor integer not null default 0,
  instructor_share_minor integer not null default 0,
  provider text not null default 'paystack',
  reference text not null unique,
  status public.payment_status not null default 'pending',
  note text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_status_idx on public.payments (status, paid_at desc);
create index payments_instructor_idx on public.payments (instructor_id);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles (id) on delete restrict,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'NGN',
  status public.payout_status not null default 'pending',
  reference text,
  note text,
  paid_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index payouts_instructor_idx on public.payouts (instructor_id);

alter table public.payments enable row level security;
alter table public.payouts enable row level security;

create policy "users see own payments, instructors see their sales"
  on public.payments for select
  to authenticated
  using (user_id = auth.uid() or instructor_id = auth.uid() or public.is_admin());

create policy "instructors see own payouts"
  on public.payouts for select
  to authenticated
  using (instructor_id = auth.uid() or public.is_admin());

-- Platform settings ------------------------------------------------------------

create table public.platform_settings (
  id boolean primary key default true check (id),
  commission_percent numeric(5, 2) not null default 20 check (commission_percent between 0 and 100),
  support_email text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.platform_settings (id) values (true);

alter table public.platform_settings enable row level security;

create policy "settings readable by signed-in users"
  on public.platform_settings for select
  to authenticated
  using (true);

-- Admin audit log ------------------------------------------------------------

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index admin_audit_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;
-- No policies: service role only.

-- Admin read helpers (service role only) ------------------------------------------

-- Users with emails + activity counts. Reads auth.users, so never expose to clients.
create or replace function public.admin_list_users(
  p_search text default null,
  p_role public.user_role default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  role public.user_role,
  status public.account_status,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed boolean,
  enrollment_count integer,
  course_count integer,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select p.*, u.email::text as email, u.last_sign_in_at, u.email_confirmed_at is not null as email_confirmed
    from public.profiles p
    join auth.users u on u.id = p.id
    where (p_role is null or p.role = p_role)
      and (
        p_search is null or p_search = ''
        or u.email ilike '%' || p_search || '%'
        or p.full_name ilike '%' || p_search || '%'
      )
  )
  select
    b.id, b.email, b.full_name, b.avatar_url, b.role, b.status, b.created_at, b.last_sign_in_at, b.email_confirmed,
    (select count(*)::integer from public.enrollments e where e.user_id = b.id),
    (select count(*)::integer from public.courses c where c.instructor_id = b.id),
    count(*) over ()
  from base b
  order by b.created_at desc
  limit p_limit offset p_offset;
$$;

-- Daily counts for the tracking chart.
create or replace function public.admin_daily_activity(p_days integer default 30)
returns table (day date, signups integer, enrollments integer, completions integer, page_views integer, active_users integer)
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select generate_series(current_date - (p_days - 1), current_date, interval '1 day')::date as day
  )
  select
    d.day,
    count(*) filter (where e.type = 'signup')::integer,
    count(*) filter (where e.type = 'enroll')::integer,
    count(*) filter (where e.type = 'lesson_complete')::integer,
    count(*) filter (where e.type = 'page_view')::integer,
    count(distinct e.user_id)::integer
  from days d
  left join public.activity_events e on e.created_at::date = d.day
  group by d.day
  order by d.day;
$$;

-- Monthly revenue for the financials chart.
create or replace function public.admin_monthly_revenue(p_months integer default 12)
returns table (month date, gross_minor bigint, platform_minor bigint, instructor_minor bigint, sales integer)
language sql
stable
security definer
set search_path = ''
as $$
  with months as (
    select generate_series(
      date_trunc('month', current_date) - make_interval(months => p_months - 1),
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month
  )
  select
    m.month,
    coalesce(sum(p.amount_minor), 0)::bigint,
    coalesce(sum(p.platform_fee_minor), 0)::bigint,
    coalesce(sum(p.instructor_share_minor), 0)::bigint,
    count(p.id)::integer
  from months m
  left join public.payments p
    on p.status = 'success' and date_trunc('month', p.paid_at)::date = m.month
  group by m.month
  order by m.month;
$$;

-- What each instructor has earned, been paid, and is owed.
create or replace function public.admin_instructor_balances()
returns table (instructor_id uuid, full_name text, earned_minor bigint, paid_minor bigint, pending_minor bigint, sales integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pr.id,
    pr.full_name,
    coalesce(e.earned, 0)::bigint,
    coalesce(o.paid, 0)::bigint,
    coalesce(o.pending, 0)::bigint,
    coalesce(e.sales, 0)::integer
  from public.profiles pr
  left join (
    select instructor_id, sum(instructor_share_minor) as earned, count(*) as sales
    from public.payments where status = 'success' group by instructor_id
  ) e on e.instructor_id = pr.id
  left join (
    select instructor_id,
      sum(amount_minor) filter (where status = 'paid') as paid,
      sum(amount_minor) filter (where status = 'pending') as pending
    from public.payouts group by instructor_id
  ) o on o.instructor_id = pr.id
  where e.instructor_id is not null or o.instructor_id is not null
  order by coalesce(e.earned, 0) - coalesce(o.paid, 0) desc;
$$;

revoke execute on function public.admin_list_users(text, public.user_role, integer, integer) from public, anon, authenticated;
revoke execute on function public.admin_daily_activity(integer) from public, anon, authenticated;
revoke execute on function public.admin_monthly_revenue(integer) from public, anon, authenticated;
revoke execute on function public.admin_instructor_balances() from public, anon, authenticated;
grant execute on function public.admin_list_users(text, public.user_role, integer, integer) to service_role;
grant execute on function public.admin_daily_activity(integer) to service_role;
grant execute on function public.admin_monthly_revenue(integer) to service_role;
grant execute on function public.admin_instructor_balances() to service_role;
