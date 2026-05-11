-- =====================================================================
-- 16STORE — SCHEMA V2 (Phase 1)
-- Stack: Supabase Postgres
-- Tables: users, hubs, posts, payments, qr_codes
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────
create type user_role as enum ('seller', 'buyer', 'hub_admin', 'super_admin');
create type post_status as enum ('draft', 'pending_verify', 'live', 'reserved', 'sold', 'rejected', 'withdrawn');
create type post_condition as enum ('DS', 'VNDS', '9_5', '9', '8_5', '8');
create type payment_status as enum ('pending', 'held', 'cleared', 'refunded', 'failed');
create type hub_status as enum ('open', 'busy', 'closed', 'setup');
create type qr_purpose as enum ('lot_tag', 'hub_intake', 'verify_step', 'payout_receipt');

-- ─────────────────────────────────────────────────────────────────────
-- TABLE: users
-- Note: extends auth.users (Supabase Auth), id same as auth.users.id
-- ─────────────────────────────────────────────────────────────────────
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,           -- @duy_archive
  display_name text,
  avatar_url text,
  role user_role not null default 'seller',
  reputation_score integer not null default 0,
  total_pairs_sold integer not null default 0,
  total_volume_vnd bigint not null default 0,
  hub_id uuid,                            -- nullable; only set if user is hub_admin
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_users_handle on public.users(handle);
create index idx_users_role on public.users(role);

-- ─────────────────────────────────────────────────────────────────────
-- TABLE: hubs
-- ─────────────────────────────────────────────────────────────────────
create table public.hubs (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,             -- HN_THAIHA, SGN_Q1, DN, CTO
  name text not null,                    -- "Thái Hà"
  city text not null,                    -- "Hà Nội"
  address text not null,
  lat numeric(10, 7),
  lng numeric(10, 7),
  status hub_status not null default 'setup',
  active_lots integer not null default 0,
  capacity integer not null default 200,
  verifier_count integer not null default 0,
  opens_at time,
  closes_at time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_hubs_status on public.hubs(status);

-- Add FK for users.hub_id now that hubs table exists
alter table public.users add constraint fk_users_hub foreign key (hub_id) references public.hubs(id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────
-- TABLE: posts (the consignment listings)
-- ─────────────────────────────────────────────────────────────────────
create table public.posts (
  id uuid primary key default uuid_generate_v4(),
  lot_id text unique not null,           -- "A-481", "V-016" — generated, human readable
  seller_id uuid not null references public.users(id) on delete cascade,
  hub_id uuid references public.hubs(id) on delete set null,

  -- product info
  brand text not null,                   -- "Air Jordan", "Nike SB"
  model text not null,                   -- "AJ4 Bred Reimagined"
  colorway text,                         -- "Bred"
  size_us numeric(3, 1) not null,        -- 9.5
  condition post_condition not null,
  release_year integer,

  -- pricing (VNĐ — store in raw integer)
  asking_price_vnd bigint not null,
  reserve_price_vnd bigint,              -- minimum the seller will accept
  market_avg_vnd bigint,                 -- snapshot from pricing engine at listing time

  -- status flow
  status post_status not null default 'draft',

  -- media
  image_urls text[] not null default '{}',
  cover_image_url text,

  -- verification flags (4-step)
  verify_stitching boolean not null default false,
  verify_sole boolean not null default false,
  verify_materials boolean not null default false,
  verify_box boolean not null default false,
  verified_at timestamptz,
  verified_by uuid references public.users(id),

  -- engagement / display
  view_count integer not null default 0,
  is_featured boolean not null default false,

  -- timestamps
  listed_at timestamptz,                 -- when status moved to 'live'
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_posts_status on public.posts(status);
create index idx_posts_seller on public.posts(seller_id);
create index idx_posts_hub on public.posts(hub_id);
create index idx_posts_brand on public.posts(brand);
create index idx_posts_size on public.posts(size_us);
create index idx_posts_listed_at on public.posts(listed_at desc);
create index idx_posts_lot_id on public.posts(lot_id);

-- ─────────────────────────────────────────────────────────────────────
-- TABLE: payments
-- ─────────────────────────────────────────────────────────────────────
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.posts(id) on delete cascade,
  buyer_id uuid not null references public.users(id),
  seller_id uuid not null references public.users(id),

  -- amounts (all in VNĐ)
  gross_amount_vnd bigint not null,      -- buyer pays
  platform_fee_vnd bigint not null,      -- 16store cut (12% default)
  seller_payout_vnd bigint not null,     -- gross - fee
  fee_rate numeric(4, 4) not null default 0.12,

  status payment_status not null default 'pending',
  payment_method text,                   -- "bank_transfer", "momo", "vnpay" etc

  -- escrow / payout timeline
  held_at timestamptz,                   -- when payment received & held
  cleared_at timestamptz,                -- when payout sent to seller
  payout_reference text,                 -- bank txn ref

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_payments_post on public.payments(post_id);
create index idx_payments_buyer on public.payments(buyer_id);
create index idx_payments_seller on public.payments(seller_id);
create index idx_payments_status on public.payments(status);

-- ─────────────────────────────────────────────────────────────────────
-- TABLE: qr_codes
-- Each pair gets a QR (lot_tag); also for hub intake & verify steps
-- ─────────────────────────────────────────────────────────────────────
create table public.qr_codes (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,             -- the actual QR payload, e.g. "16S:LOT:A-481:abc123"
  purpose qr_purpose not null,
  post_id uuid references public.posts(id) on delete cascade,
  hub_id uuid references public.hubs(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,

  scan_count integer not null default 0,
  last_scanned_at timestamptz,
  is_active boolean not null default true,

  metadata jsonb default '{}'::jsonb,    -- flexible extra data
  created_at timestamptz not null default now(),
  expires_at timestamptz                 -- nullable; some QRs never expire
);

create index idx_qr_code on public.qr_codes(code);
create index idx_qr_post on public.qr_codes(post_id);
create index idx_qr_purpose on public.qr_codes(purpose);

-- ─────────────────────────────────────────────────────────────────────
-- TRIGGER: auto-update updated_at
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at before update on public.users for each row execute function public.handle_updated_at();
create trigger hubs_updated_at before update on public.hubs for each row execute function public.handle_updated_at();
create trigger posts_updated_at before update on public.posts for each row execute function public.handle_updated_at();
create trigger payments_updated_at before update on public.payments for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- TRIGGER: auto-create users row when auth.users row created
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
security definer set search_path = public
as $$
begin
  insert into public.users (id, handle, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'handle', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'display_name', new.email)
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.hubs enable row level security;
alter table public.posts enable row level security;
alter table public.payments enable row level security;
alter table public.qr_codes enable row level security;

-- USERS: anyone can read public profile; only self can update
create policy "users_select_all" on public.users for select using (true);
create policy "users_update_self" on public.users for update using (auth.uid() = id);

-- HUBS: anyone can read; only super_admin can write (for now)
create policy "hubs_select_all" on public.hubs for select using (true);

-- POSTS: anyone can read live posts; sellers can manage own
create policy "posts_select_public" on public.posts for select using (
  status in ('live', 'reserved', 'sold') or seller_id = auth.uid()
);
create policy "posts_insert_self" on public.posts for insert with check (auth.uid() = seller_id);
create policy "posts_update_owner" on public.posts for update using (auth.uid() = seller_id);

-- PAYMENTS: only buyer/seller of the txn can see
create policy "payments_select_parties" on public.payments for select using (
  auth.uid() = buyer_id or auth.uid() = seller_id
);
create policy "payments_insert_buyer" on public.payments for insert with check (auth.uid() = buyer_id);

-- QR_CODES: anyone can read active codes (needed for scan resolution)
create policy "qr_select_active" on public.qr_codes for select using (is_active = true);

-- ─────────────────────────────────────────────────────────────────────
-- VIEWS for convenient querying
-- ─────────────────────────────────────────────────────────────────────
create or replace view public.posts_with_seller as
select
  p.*,
  u.handle as seller_handle,
  u.display_name as seller_name,
  u.avatar_url as seller_avatar,
  u.reputation_score as seller_reputation,
  h.code as hub_code,
  h.name as hub_name,
  h.city as hub_city
from public.posts p
left join public.users u on u.id = p.seller_id
left join public.hubs h on h.id = p.hub_id;
