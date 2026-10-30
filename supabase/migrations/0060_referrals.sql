-- Etivio Africa: referrals.
-- Everyone gets a short code for their invite link (etivio.co/r/<code>). Someone who signs up through it is linked
-- to the person who invited them. When that friend's first paid order clears, both get wallet credit: the inviter a
-- share of what the friend paid (up to a cap), the friend some cash back. Rates live in platform_settings; the
-- "referrals" feature switch turns rewards off.

-- Codes: 7 characters without look-alikes (0/o, 1/l/i).
create or replace function public.new_referral_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..7 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where referral_code = code);
  end loop;
  return code;
end;
$$;
revoke all on function public.new_referral_code() from public, anon, authenticated;

alter table public.profiles
  add column referral_code text default public.new_referral_code(),
  add column referred_by uuid references public.profiles (id) on delete set null,
  add column referred_at timestamptz;
update public.profiles set referral_code = public.new_referral_code() where referral_code is null;
alter table public.profiles
  alter column referral_code set not null,
  add constraint profiles_referral_code_key unique (referral_code),
  add constraint profiles_not_self_referred check (referred_by is null or referred_by <> id);
create index profiles_referred_by_idx on public.profiles (referred_by) where referred_by is not null;

alter table public.platform_settings
  add column referral_percent numeric(5, 2) not null default 10 check (referral_percent between 0 and 50),
  add column referral_cap_minor integer not null default 500000 check (referral_cap_minor >= 0),
  add column referral_friend_percent numeric(5, 2) not null default 5 check (referral_friend_percent between 0 and 50),
  add column referral_days smallint not null default 90 check (referral_days between 1 and 365);

-- Rewards are wallet credits. referral_friend_id is the friend whose purchase earned it (the friend's own cash back
-- points at themselves), so each side is credited once per friend.
alter table public.wallet_transactions drop constraint wallet_transactions_kind_check;
alter table public.wallet_transactions
  add constraint wallet_transactions_kind_check check (kind in ('group_refund', 'spend', 'adjustment', 'topup', 'referral')),
  add column referral_friend_id uuid references public.profiles (id) on delete set null;
create unique index wallet_referral_once on public.wallet_transactions (user_id, referral_friend_id) where kind = 'referral';

-- Links a new account to whoever's code it signed up with. Only within a day of the account being made, only once,
-- never to yourself. Returns true when it linked.
create or replace function public.claim_referral(p_user uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inviter uuid;
  friend_name text;
begin
  select id into inviter from public.profiles where referral_code = lower(trim(p_code)) and deleted_at is null;
  if inviter is null or inviter = p_user then return false; end if;
  update public.profiles set referred_by = inviter, referred_at = now()
    where id = p_user and referred_by is null and created_at > now() - interval '1 day'
    returning coalesce(nullif(full_name, ''), 'Someone') into friend_name;
  if not found then return false; end if;
  perform public.notify(inviter, 'referral', friend_name || ' joined Etivio with your link', 'You''ll earn wallet credit when they buy their first course.', '/learn/invite');
  return true;
end;
$$;
revoke all on function public.claim_referral(uuid, text) from public, anon, authenticated;

-- Email sign-ups carry the code in their metadata, so the link holds even if the confirmation email is opened on
-- another device. Google sign-ups are linked in /auth/callback instead.
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
  -- A bad invite code must never stop an account being made.
  if coalesce(new.raw_user_meta_data ->> 'ref', '') <> '' then
    begin
      perform public.claim_referral(new.id, new.raw_user_meta_data ->> 'ref');
    exception when others then null;
    end;
  end if;
  return new;
end;
$$;

-- Called when an order clears. Credits both sides on the friend's first paid purchase within the window. Only money
-- Paystack actually charged counts (not wallet spending or coupon discounts). Safe to call more than once.
create or replace function public.reward_referral(p_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
  p record;
  s record;
  inviter_cut integer;
  friend_cut integer;
  friend_name text;
  money text;
begin
  if coalesce((select status from public.feature_flags where key = 'referrals'), 'on') = 'off' then return; end if;
  select id, user_id, total_minor, currency, status, purpose into o from public.orders where id = p_order;
  if o.id is null or o.status <> 'success' or o.purpose <> 'purchase' or o.user_id is null or o.total_minor <= 0 then return; end if;
  select id, referred_by, referred_at, coalesce(nullif(full_name, ''), 'Your friend') as name into p from public.profiles where id = o.user_id;
  if p.referred_by is null then return; end if;
  select * into s from public.platform_settings where id;
  if p.referred_at < now() - make_interval(days => s.referral_days) then return; end if;
  -- Their first paid purchase only.
  if exists (select 1 from public.wallet_transactions where kind = 'referral' and referral_friend_id = p.id) then return; end if;

  inviter_cut := least(floor(o.total_minor * s.referral_percent / 100)::integer, s.referral_cap_minor);
  friend_cut := least(floor(o.total_minor * s.referral_friend_percent / 100)::integer, s.referral_cap_minor);
  friend_name := p.name;

  if inviter_cut > 0 then
    insert into public.wallet_transactions (user_id, amount_minor, currency, kind, order_id, referral_friend_id, note)
      values (p.referred_by, inviter_cut, o.currency, 'referral', o.id, p.id, 'Invite reward: ' || friend_name || '''s first course')
      on conflict do nothing;
    if found then
      money := '₦' || to_char(inviter_cut / 100.0, 'FM999,999,990');
      perform public.notify(p.referred_by, 'referral', 'You earned ' || money, friend_name || ' bought their first course. The credit is in your wallet.', '/learn/wallet');
    end if;
  end if;
  if friend_cut > 0 then
    insert into public.wallet_transactions (user_id, amount_minor, currency, kind, order_id, referral_friend_id, note)
      values (p.id, friend_cut, o.currency, 'referral', o.id, p.id, 'Cash back on your first course')
      on conflict do nothing;
    if found then
      money := '₦' || to_char(friend_cut / 100.0, 'FM999,999,990');
      perform public.notify(p.id, 'referral', money || ' cash back', 'A thank-you for joining through a friend. It''s in your wallet for your next course.', '/learn/wallet');
    end if;
  end if;
end;
$$;
revoke all on function public.reward_referral(uuid) from public, anon, authenticated;
