-- Etivio Africa: coaches and booking. Etivio recruits coaches (the `coach` role, granted by an admin or through an
-- application). A coach sets a profile, a price per session and weekly hours; learners pick a free time and pay.
-- A booking holds its time for 30 minutes while payment is made, and two live bookings can never overlap.
-- The coach's share is a payments row (coach_booking_id), so it shows in Earnings and is withdrawn like tutor sales,
-- but only once the session time has passed. Cancelled sessions go back to the learner's wallet.

create extension if not exists btree_gist;

create table public.coach_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  headline text check (length(headline) <= 120),
  bio text check (length(bio) <= 3000),
  topics text[] not null default '{}',
  session_minutes smallint not null default 60 check (session_minutes in (30, 45, 60, 90)),
  price_minor integer not null default 0 check (price_minor >= 0),
  currency text not null default 'NGN',
  timezone text not null default 'Africa/Lagos',
  -- How soon a learner can book (hours from now) and how far ahead (days).
  notice_hours smallint not null default 12 check (notice_hours between 0 and 168),
  window_days smallint not null default 30 check (window_days between 7 and 90),
  -- The coach's own video link (Google Meet, Zoom...) until sessions run inside Etivio.
  meeting_url text check (meeting_url is null or meeting_url ~ '^https://'),
  -- draft until the coach publishes; paused hides them; suspended is set by Etivio and only Etivio lifts it.
  status text not null default 'draft' check (status in ('draft', 'live', 'paused', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Weekly hours in the coach's timezone, as minutes from midnight. A day can have several ranges.
create table public.coach_hours (
  id bigint generated always as identity primary key,
  coach_id uuid not null references public.coach_profiles (user_id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_min smallint not null check (start_min between 0 and 1439),
  end_min smallint not null check (end_min between 1 and 1440),
  check (start_min < end_min)
);
create index coach_hours_coach_idx on public.coach_hours (coach_id, weekday);

create table public.coach_days_off (
  coach_id uuid not null references public.coach_profiles (user_id) on delete cascade,
  day date not null,
  primary key (coach_id, day)
);

create table public.coach_bookings (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles (user_id) on delete restrict,
  learner_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  price_minor integer not null check (price_minor >= 0),
  currency text not null default 'NGN',
  order_id uuid references public.orders (id) on delete set null,
  -- What the learner wants from the session.
  note text check (length(note) <= 1000),
  meeting_url text,
  -- Pending bookings release their time after this.
  hold_expires_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancel_reason text check (length(cancel_reason) <= 500),
  cancelled_at timestamptz,
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at),
  constraint coach_bookings_no_overlap exclude using gist (coach_id with =, tstzrange(starts_at, ends_at) with &&) where (status in ('pending', 'confirmed'))
);
create index coach_bookings_learner_idx on public.coach_bookings (learner_id, starts_at desc);
create index coach_bookings_coach_idx on public.coach_bookings (coach_id, starts_at desc);
create index coach_bookings_order_idx on public.coach_bookings (order_id);

-- Coach sessions are paid like everything else: an order (purpose coach_booking) with one payments row.
alter table public.orders drop constraint orders_purpose_check;
alter table public.orders add constraint orders_purpose_check check (purpose in ('purchase', 'wallet_topup', 'coach_booking'));
alter table public.payments add column coach_booking_id uuid references public.coach_bookings (id) on delete set null;
create index payments_coach_booking_idx on public.payments (coach_booking_id);
alter table public.platform_settings add column coach_commission_percent numeric(5, 2) not null default 20 check (coach_commission_percent between 0 and 100);

alter table public.wallet_transactions drop constraint wallet_transactions_kind_check;
alter table public.wallet_transactions add constraint wallet_transactions_kind_check check (kind in ('group_refund', 'spend', 'adjustment', 'topup', 'session_refund'));
alter table public.wallet_transactions add column coach_booking_id uuid references public.coach_bookings (id) on delete set null;
create unique index wallet_session_refund_once on public.wallet_transactions (coach_booking_id) where kind = 'session_refund';

-- Earnings: coach sessions count once their time has passed (and weren't cancelled). Everything else as before.
create or replace function public.payout_available(p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select sum(p.instructor_share_minor)
      from public.payments p
      left join public.orders o on o.id = p.order_id
      left join public.group_buys g on g.id = o.group_buy_id
      left join public.coach_bookings b on b.id = p.coach_booking_id
     where p.instructor_id = p_user and p.status = 'success'
       and (g.id is null or g.status = 'filled')
       and (p.coach_booking_id is null or (b.status in ('confirmed', 'completed', 'no_show') and b.ends_at < now()))
  ), 0)::bigint
  - coalesce((select sum(amount_minor) from public.payouts where instructor_id = p_user and status in ('pending', 'paid')), 0)::bigint;
$$;
revoke all on function public.payout_available(uuid) from public, anon, authenticated;

-- Cancels a confirmed session and puts what the learner paid back in their wallet. Returns false if it wasn't
-- confirmed (already cancelled, or never paid). The server checks who may cancel and when before calling this.
create or replace function public.cancel_coach_booking(p_booking uuid, p_by uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.coach_bookings%rowtype;
begin
  select * into b from public.coach_bookings where id = p_booking for update;
  if not found or b.status <> 'confirmed' then return false; end if;
  update public.coach_bookings set status = 'cancelled', cancelled_by = p_by, cancel_reason = p_reason, cancelled_at = now() where id = p_booking;
  update public.payments set status = 'refunded', note = 'Session cancelled, refunded to wallet' where coach_booking_id = p_booking and status = 'success';
  if b.price_minor > 0 then
    insert into public.wallet_transactions (user_id, amount_minor, currency, kind, order_id, coach_booking_id, note)
    values (b.learner_id, b.price_minor, b.currency, 'session_refund', b.order_id, b.id, 'Coaching session cancelled')
    on conflict do nothing;
  end if;
  return true;
end;
$$;
revoke all on function public.cancel_coach_booking(uuid, uuid, text) from public, anon, authenticated;

-- Unpaid holds give their time back.
create or replace function public.release_coach_holds()
returns integer
language sql
security definer
set search_path = ''
as $$
  with released as (
    update public.coach_bookings set status = 'cancelled', cancel_reason = 'Not paid in time', cancelled_at = now()
     where status = 'pending' and hold_expires_at < now()
    returning 1
  )
  select count(*)::integer from released;
$$;
revoke all on function public.release_coach_holds() from public, anon, authenticated;
select cron.schedule('release-coach-holds', '*/10 * * * *', $$select public.release_coach_holds()$$);

-- Session reminders (an hour before) are emailed by the app.
select cron.schedule(
  'coach-reminders',
  '*/10 * * * *',
  $$
  select net.http_get(
    url := 'https://etivio.co/api/cron/coach-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'))
  );
  $$
);

alter table public.coach_profiles enable row level security;
alter table public.coach_hours enable row level security;
alter table public.coach_days_off enable row level security;
alter table public.coach_bookings enable row level security;

create policy "live coaches are public" on public.coach_profiles for select to anon, authenticated using (status = 'live' or user_id = (select auth.uid()) or public.is_admin());
create policy "coach hours are public" on public.coach_hours for select to anon, authenticated using (true);
create policy "coaches see their days off" on public.coach_days_off for select to authenticated using (coach_id = (select auth.uid()) or public.is_admin());
create policy "people see their own sessions" on public.coach_bookings for select to authenticated using (learner_id = (select auth.uid()) or coach_id = (select auth.uid()) or public.is_admin());
revoke all on public.coach_profiles, public.coach_hours, public.coach_days_off, public.coach_bookings from anon, authenticated;
grant select on public.coach_profiles, public.coach_hours to anon, authenticated;
grant select on public.coach_days_off, public.coach_bookings to authenticated;
