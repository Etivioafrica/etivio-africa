-- Etivio Africa: invoice details + receipt email for buyers, payout bank account for tutors.
-- Kept out of `profiles` because profiles are publicly readable.

create table public.billing_details (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  name text check (char_length(name) <= 120),
  company text check (char_length(company) <= 120),
  address text check (char_length(address) <= 300),
  city text check (char_length(city) <= 80),
  country text check (char_length(country) <= 80),
  tax_id text check (char_length(tax_id) <= 40),
  receipt_email text check (char_length(receipt_email) <= 254),
  updated_at timestamptz not null default now()
);

create trigger billing_details_updated_at
  before update on public.billing_details
  for each row execute function public.set_updated_at();

alter table public.billing_details enable row level security;

create policy "users manage own billing details"
  on public.billing_details for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Payout accounts are written by the server (service role) after a role check, so `verified_at`
-- can only be set once the account name has been confirmed with Paystack.
create table public.payout_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  bank_code text not null,
  bank_name text not null,
  account_number text not null check (account_number ~ '^[0-9]{10}$'),
  account_name text not null check (char_length(account_name) <= 120),
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger payout_accounts_updated_at
  before update on public.payout_accounts
  for each row execute function public.set_updated_at();

alter table public.payout_accounts enable row level security;

create policy "tutors read own payout account"
  on public.payout_accounts for select
  to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on public.payout_accounts from anon, authenticated;
