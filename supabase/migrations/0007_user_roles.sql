-- Etivio Africa: multi-role accounts, role applications, soft delete.
-- One account can hold several roles. Everyone is a student; tutor/coach/event manager/community owner
-- are applied for and approved; staff roles (super admin, editor, accountant) are granted by a super admin.

create type public.app_role as enum (
  'super_admin', 'editor', 'accountant',
  'tutor', 'student', 'coach', 'event_manager', 'community_owner'
);
create type public.application_status as enum ('pending', 'approved', 'rejected');

-- Soft delete ------------------------------------------------------------

alter table public.profiles
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null;

-- Roles ------------------------------------------------------------------

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index user_roles_role_idx on public.user_roles (role);

insert into public.user_roles (user_id, role) select id, 'student' from public.profiles;
insert into public.user_roles (user_id, role) select id, 'tutor' from public.profiles where role = 'instructor';
insert into public.user_roles (user_id, role) select id, 'super_admin' from public.profiles where role in ('admin', 'super_admin');

-- Old single-role column and everything that read it.
drop function if exists public.become_instructor();
drop function if exists public.admin_list_users(text, public.user_role, integer, integer);
alter table public.profiles drop column role;
drop type public.user_role;

create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = auth.uid() and r.role = p_role and p.status = 'active' and p.deleted_at is null
  );
$$;

-- Full admin (existing policies use this name).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('super_admin');
$$;

create or replace function public.is_instructor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('tutor') or public.has_role('super_admin');
$$;

grant execute on function public.has_role(public.app_role) to authenticated;

alter table public.user_roles enable row level security;

create policy "users read own roles"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Every new account starts as a student.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end;
$$;

-- Editors manage the blog.
drop policy "published posts are readable by everyone" on public.blog_posts;
create policy "published posts are readable by everyone"
  on public.blog_posts for select
  using (status = 'published' or public.is_admin() or public.has_role('editor'));

-- Role applications --------------------------------------------------------

create table public.role_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null check (role in ('tutor', 'coach', 'event_manager', 'community_owner')),
  status public.application_status not null default 'pending',
  message text check (message is null or length(message) <= 2000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create unique index role_applications_one_pending on public.role_applications (user_id, role) where status = 'pending';
create index role_applications_status_idx on public.role_applications (status, created_at desc);

alter table public.role_applications enable row level security;

create policy "users read own applications"
  on public.role_applications for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "users apply for themselves"
  on public.role_applications for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null);

-- Admin user listing (service role only) -----------------------------------------

create or replace function public.admin_list_users(
  p_search text default null,
  p_role public.app_role default null,
  p_deleted boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  roles public.app_role[],
  status public.account_status,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed boolean,
  deleted_at timestamptz,
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
    select p.*, u.email::text as email, u.last_sign_in_at, u.email_confirmed_at is not null as email_confirmed,
      coalesce((select array_agg(r.role order by r.role) from public.user_roles r where r.user_id = p.id), '{}') as roles
    from public.profiles p
    join auth.users u on u.id = p.id
    where (p_deleted and p.deleted_at is not null or not p_deleted and p.deleted_at is null)
      and (p_role is null or exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = p_role))
      and (
        p_search is null or p_search = ''
        or u.email ilike '%' || p_search || '%'
        or p.full_name ilike '%' || p_search || '%'
      )
  )
  select
    b.id, b.email, b.full_name, b.avatar_url, b.roles, b.status, b.created_at, b.last_sign_in_at, b.email_confirmed, b.deleted_at,
    (select count(*)::integer from public.enrollments e where e.user_id = b.id),
    (select count(*)::integer from public.courses c where c.instructor_id = b.id),
    count(*) over ()
  from base b
  order by b.created_at desc
  limit p_limit offset p_offset;
$$;

revoke execute on function public.admin_list_users(text, public.app_role, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_list_users(text, public.app_role, boolean, integer, integer) to service_role;
