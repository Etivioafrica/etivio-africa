-- Etivio Africa: reviews and ratings for marketplace products (templates, e-books, resource packs, bundles).
-- Same rules as course reviews: only owners can review, one review each, hidden until an admin approves it.

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  approved boolean not null default false,
  admin_reply text check (char_length(admin_reply) <= 2000),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index product_reviews_product_idx on public.product_reviews (product_id, approved);

create trigger product_reviews_updated_at
  before update on public.product_reviews
  for each row execute function public.set_updated_at();

alter table public.product_reviews enable row level security;
create policy "approved product reviews and your own are readable"
  on public.product_reviews for select to authenticated
  using (approved or user_id = auth.uid());
revoke all on public.product_reviews from anon, authenticated;
grant select on public.product_reviews to authenticated;

-- Public star ratings for marketplace cards (approved reviews only).
create or replace function public.product_ratings(p_product_ids uuid[])
returns table (product_id uuid, rating numeric, reviews integer)
language sql
stable
security definer
set search_path = public
as $$
  select r.product_id, round(avg(r.rating)::numeric, 1), count(*)::integer
  from product_reviews r
  where r.approved and r.product_id = any (p_product_ids)
  group by r.product_id;
$$;

revoke all on function public.product_ratings(uuid[]) from public;
grant execute on function public.product_ratings(uuid[]) to anon, authenticated, service_role;
