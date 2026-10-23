-- Etivio Africa: group buy and the Etivio wallet.
-- Admins switch group buy on per course (size, discount, days to fill). A buyer starts a group and shares the link;
-- everyone pays the discounted price. When the group fills, every member is enrolled. If time runs out first, each
-- member's payment is credited to their wallet (and the tutor's share is reversed), to spend on any course later.

alter table public.courses
  add column group_buy_enabled boolean not null default false,
  add column group_size smallint not null default 5 check (group_size between 2 and 50),
  add column group_discount_percent smallint not null default 20 check (group_discount_percent between 10 and 40),
  add column group_days smallint not null default 7 check (group_days between 1 and 30);

create type public.group_buy_status as enum ('open', 'filled', 'expired');

create table public.group_buys (
  id uuid primary key default gen_random_uuid(),
  -- Short code for the share link: etivio.co/groups/<code>
  code text not null unique,
  course_id uuid not null references public.courses (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  -- Copied from the course when the group starts, so later setting changes don't affect it.
  size smallint not null,
  discount_percent smallint not null,
  unit_price_minor integer not null check (unit_price_minor >= 0),
  currency text not null default 'NGN',
  status public.group_buy_status not null default 'open',
  expires_at timestamptz not null,
  filled_at timestamptz,
  created_at timestamptz not null default now()
);
create index group_buys_course_idx on public.group_buys (course_id, status);
create index group_buys_open_idx on public.group_buys (expires_at) where status = 'open';

-- Paid members only (a row is added when the member's payment clears).
create table public.group_buy_members (
  group_id uuid not null references public.group_buys (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.orders
  add column group_buy_id uuid references public.group_buys (id) on delete set null,
  -- Part of the order paid from the buyer's wallet (total_minor is what Paystack charges).
  add column wallet_minor integer not null default 0 check (wallet_minor >= 0);

-- The wallet is a ledger: credits are positive, spending is negative, the balance is the sum.
create table public.wallet_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_minor integer not null check (amount_minor <> 0),
  currency text not null default 'NGN',
  kind text not null check (kind in ('group_refund', 'spend', 'adjustment')),
  group_buy_id uuid references public.group_buys (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index wallet_transactions_user_idx on public.wallet_transactions (user_id, created_at desc);
-- An order is paid from the wallet once, and a member is credited once per group.
create unique index wallet_spend_once on public.wallet_transactions (order_id) where kind = 'spend';
create unique index wallet_group_refund_once on public.wallet_transactions (group_buy_id, user_id) where kind = 'group_refund';

alter table public.group_buys enable row level security;
alter table public.group_buy_members enable row level security;
alter table public.wallet_transactions enable row level security;
create policy "people see their own wallet" on public.wallet_transactions for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
revoke all on public.group_buys, public.group_buy_members, public.wallet_transactions from anon, authenticated;
grant select on public.wallet_transactions to authenticated;

create or replace function public.wallet_balance(p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount_minor), 0)::bigint from public.wallet_transactions where user_id = p_user;
$$;
revoke all on function public.wallet_balance(uuid) from public, anon, authenticated;

-- Takes `p_amount` from a wallet for an order, only if the balance covers it. One spend per order.
create or replace function public.spend_wallet(p_user uuid, p_amount integer, p_order uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount <= 0 then return true; end if;
  perform pg_advisory_xact_lock(hashtext('wallet:' || p_user::text));
  if exists (select 1 from public.wallet_transactions where order_id = p_order and kind = 'spend') then return true; end if;
  if public.wallet_balance(p_user) < p_amount then return false; end if;
  insert into public.wallet_transactions (user_id, amount_minor, kind, order_id, note) values (p_user, -p_amount, 'spend', p_order, 'Paid for an order');
  return true;
end;
$$;
revoke all on function public.spend_wallet(uuid, integer, uuid) from public, anon, authenticated;

-- Credits one member's payment for a group that didn't fill, and reverses the tutor's share of it.
create or replace function public.credit_group_member(p_group uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  select gm.order_id, o.total_minor + o.wallet_minor as paid, c.title
    into m
    from public.group_buy_members gm
    join public.orders o on o.id = gm.order_id
    join public.group_buys g on g.id = gm.group_id
    join public.courses c on c.id = g.course_id
   where gm.group_id = p_group and gm.user_id = p_user;
  if not found or m.paid <= 0 then return; end if;
  insert into public.wallet_transactions (user_id, amount_minor, kind, group_buy_id, order_id, note)
  values (p_user, m.paid, 'group_refund', p_group, m.order_id, 'Group for "' || m.title || '" didn''t fill in time')
  on conflict do nothing;
  update public.payments set status = 'refunded', note = 'Group buy didn''t fill: credited to the buyer''s wallet'
   where order_id = m.order_id and status = 'success';
end;
$$;
revoke all on function public.credit_group_member(uuid, uuid) from public, anon, authenticated;

-- Closes groups whose time ran out and credits every member's wallet. Runs every 10 minutes.
create or replace function public.expire_group_buys()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  g record;
  m record;
  n integer := 0;
begin
  for g in select id from public.group_buys where status = 'open' and expires_at < now() for update skip locked loop
    update public.group_buys set status = 'expired' where id = g.id;
    for m in select user_id from public.group_buy_members where group_id = g.id loop
      perform public.credit_group_member(g.id, m.user_id);
    end loop;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.expire_group_buys() from public, anon, authenticated;

select cron.schedule('expire-group-buys', '*/10 * * * *', 'select public.expire_group_buys()');
