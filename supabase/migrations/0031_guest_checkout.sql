-- Guest checkout: someone without an account can buy. Their details sit on the payment until it's confirmed,
-- then an account is created (or found) for that email and the payment is attached to it.
alter table public.payments add column guest_email text, add column guest_name text;

-- Finds an existing account by email. Server only (service role), never callable from the browser.
create or replace function public.user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;
revoke all on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;
