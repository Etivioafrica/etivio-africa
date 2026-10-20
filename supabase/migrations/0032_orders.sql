-- Cart checkout: one order (one Paystack payment) can hold several items. Each item is still a row in payments,
-- so earnings, commission splits and refunds keep working per item; payments.order_id ties them together.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  -- Set straight away for signed-in buyers; for guests, once the payment clears and their account exists.
  user_id uuid references public.profiles (id) on delete set null,
  email text not null,
  first_name text not null,
  last_name text not null,
  phone text,
  country text,
  state text,
  total_minor integer not null check (total_minor >= 0),
  currency text not null default 'NGN',
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  note text,
  -- Abandoned-checkout reminders sent so far (at most 4), and when the last one went.
  reminders_sent integer not null default 0,
  last_reminded_at timestamptz,
  created_at timestamptz not null default now()
);
create index orders_user_id_idx on public.orders (user_id);
create index orders_pending_idx on public.orders (created_at) where status = 'pending';

alter table public.orders enable row level security;
create policy "buyers see their own orders"
  on public.orders for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
revoke all on public.orders from anon;
revoke insert, update, delete, truncate, trigger, references on public.orders from authenticated;
grant select on public.orders to authenticated;

alter table public.payments add column order_id uuid references public.orders (id) on delete set null;
create index payments_order_id_idx on public.payments (order_id);

-- Guest details now live on the order (added in 0031, never used by a real payment).
alter table public.payments drop column guest_email, drop column guest_name;
