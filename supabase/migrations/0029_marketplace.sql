-- Etivio Africa: marketplace. Digital products (templates, e-books, resource packs) and bundles sit next to courses
-- on the public /explore pages. Admins and tutors create them; tutors' products wait for admin approval.
-- All reads and writes go through the server (service role), so nothing here is exposed to the client directly.

create type public.product_kind as enum ('template', 'ebook', 'resource_pack', 'bundle');
create type public.product_status as enum ('draft', 'pending', 'published', 'rejected', 'archived');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  kind public.product_kind not null,
  creator_id uuid not null references public.profiles (id) on delete restrict,
  title text not null check (char_length(title) between 3 and 140),
  slug text not null unique,
  summary text check (char_length(summary) <= 300),
  -- Sanitised rich text.
  description text,
  cover_url text,
  -- Extra preview images shown on the product page.
  gallery text[] not null default '{}',
  price_minor bigint not null default 0 check (price_minor >= 0),
  -- Optional "was" price shown struck through.
  compare_at_minor bigint check (compare_at_minor is null or compare_at_minor > 0),
  currency text not null default 'NGN',
  category_id uuid references public.course_categories (id) on delete set null,
  tags text[] not null default '{}',
  -- What the files open in, e.g. Figma, Canva, PDF, Notion.
  formats text[] not null default '{}',
  status public.product_status not null default 'draft',
  review_note text check (char_length(review_note) <= 1000),
  featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_live_idx on public.products (status, published_at desc);
create index products_creator_idx on public.products (creator_id);
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();

-- Downloadable files. Stored in R2 under a random key and only handed out through /api/download after an access check.
create table public.product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  file_key text not null,
  file_name text not null check (char_length(file_name) <= 200),
  file_size bigint,
  mime_type text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_files_product_idx on public.product_files (product_id, position);

-- What a bundle contains: courses and/or other products.
create table public.bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.products (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  position integer not null default 0,
  check ((course_id is null) <> (product_id is null)),
  unique (bundle_id, course_id),
  unique (bundle_id, product_id)
);

-- Who can download a product: buyers, people who claimed a free one, and anyone granted it by an admin.
create table public.product_access (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.saved_products (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.product_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  product_id uuid not null references public.products (id) on delete cascade,
  file_id uuid references public.product_files (id) on delete set null,
  created_at timestamptz not null default now()
);
create index product_downloads_product_idx on public.product_downloads (product_id, created_at desc);

-- A payment is for a course or a product (bundles are products).
alter table public.payments add column product_id uuid references public.products (id) on delete set null;
create index payments_product_idx on public.payments (product_id);

alter table public.products enable row level security;
alter table public.product_files enable row level security;
alter table public.bundle_items enable row level security;
alter table public.product_access enable row level security;
alter table public.saved_products enable row level security;
alter table public.product_downloads enable row level security;
revoke all on public.products, public.product_files, public.bundle_items, public.product_access, public.saved_products, public.product_downloads from anon, authenticated;
