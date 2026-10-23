-- Etivio Africa: tutors request withdrawals. A request is a pending payout with the bank details at that moment;
-- an admin sends the money and marks it paid (or cancels it, which frees the amount again).

alter table public.payouts
  add column requested_by_tutor boolean not null default false,
  -- Bank, account number and name when the request was made, so later account changes don't alter it.
  add column bank_details text;

-- What a tutor can withdraw now: their share of settled sales, minus payouts already paid or waiting.
-- Sales from group buys that haven't filled yet don't count (they may still go back to the buyer's wallet).
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
     where p.instructor_id = p_user and p.status = 'success' and (g.id is null or g.status = 'filled')
  ), 0)::bigint
  - coalesce((select sum(amount_minor) from public.payouts where instructor_id = p_user and status in ('pending', 'paid')), 0)::bigint;
$$;
revoke all on function public.payout_available(uuid) from public, anon, authenticated;

-- Creates the request only if it fits in what's available. Returns the payout id, or null if it doesn't fit.
create or replace function public.request_payout(p_user uuid, p_amount integer, p_bank text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_amount <= 0 then return null; end if;
  perform pg_advisory_xact_lock(hashtext('payout:' || p_user::text));
  if public.payout_available(p_user) < p_amount then return null; end if;
  insert into public.payouts (instructor_id, amount_minor, status, requested_by_tutor, bank_details, note)
  values (p_user, p_amount, 'pending', true, p_bank, 'Withdrawal requested by the tutor')
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.request_payout(uuid, integer, text) from public, anon, authenticated;
