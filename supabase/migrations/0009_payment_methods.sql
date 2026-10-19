-- Etivio Africa: saved payment methods (Paystack reusable card authorizations).
-- Rows are written by the server after a successful Paystack charge. The authorization code is a
-- charge credential, so signed-in users can read card display details but never the code itself.

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'paystack',
  authorization_code text not null,
  brand text,
  last4 text check (last4 ~ '^[0-9]{4}$'),
  exp_month smallint check (exp_month between 1 and 12),
  exp_year smallint,
  bank text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, authorization_code)
);

create unique index payment_methods_one_default on public.payment_methods (user_id) where is_default;

alter table public.payment_methods enable row level security;

create policy "users read own payment methods"
  on public.payment_methods for select
  to authenticated
  using (user_id = auth.uid());

create policy "users update own payment methods"
  on public.payment_methods for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users remove own payment methods"
  on public.payment_methods for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on public.payment_methods from anon, authenticated;
grant select (id, user_id, provider, brand, last4, exp_month, exp_year, bank, is_default, created_at)
  on public.payment_methods to authenticated;
grant update (is_default) on public.payment_methods to authenticated;
grant delete on public.payment_methods to authenticated;
