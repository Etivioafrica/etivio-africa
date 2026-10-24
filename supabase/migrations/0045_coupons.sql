-- Coupons: discount codes for checkout. Admins create them in Admin › Coupons. A coupon is a percent or a fixed
-- naira amount off, for everything, all courses, all products or chosen items, open to anyone or only to listed
-- emails, with optional limits (total uses, uses per person, minimum order, start and end dates).
-- Only the server (service role) reads or writes these tables; checkout checks a code through a server action.

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  description text,
  kind text not null check (kind in ('percent', 'fixed')),
  -- Percent (1 to 100) or an amount in kobo.
  value integer not null check (value > 0),
  currency text not null default 'NGN',
  applies_to text not null default 'all' check (applies_to in ('all', 'courses', 'products', 'selected')),
  course_ids uuid[] not null default '{}',
  product_ids uuid[] not null default '{}',
  -- Lower-case emails of the people allowed to use it. Empty means anyone.
  emails text[] not null default '{}',
  max_uses integer check (max_uses is null or max_uses > 0),
  per_person integer check (per_person is null or per_person > 0) default 1,
  min_order_minor integer not null default 0 check (min_order_minor >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_percent_range check (kind <> 'percent' or value <= 100)
);

-- One row per paid order that used a coupon, written when the payment clears.
create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  email text not null,
  discount_minor integer not null check (discount_minor >= 0),
  created_at timestamptz not null default now()
);
create index coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id);
create index coupon_redemptions_email_idx on public.coupon_redemptions (coupon_id, email);

alter table public.orders
  add column coupon_id uuid references public.coupons (id) on delete set null,
  add column discount_minor integer not null default 0 check (discount_minor >= 0);

-- Each item's share of the discount; amount_minor on the item is already the discounted price.
alter table public.payments
  add column discount_minor integer not null default 0 check (discount_minor >= 0);

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
revoke all on public.coupons, public.coupon_redemptions from anon, authenticated;
