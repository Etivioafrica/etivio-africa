-- Etivio Africa: wallet top-ups and admin adjustments.
-- Learners can add money to their wallet through Paystack (an order with purpose 'wallet_topup' and no items, so it
-- never counts as course revenue). Admins can credit or debit a wallet with a note; who did it is kept.

alter table public.wallet_transactions drop constraint wallet_transactions_kind_check;
alter table public.wallet_transactions
  add constraint wallet_transactions_kind_check check (kind in ('group_refund', 'spend', 'adjustment', 'topup')),
  add column created_by uuid references public.profiles (id) on delete set null;
create unique index wallet_topup_once on public.wallet_transactions (order_id) where kind = 'topup';

alter table public.orders add column purpose text not null default 'purchase' check (purpose in ('purchase', 'wallet_topup'));
