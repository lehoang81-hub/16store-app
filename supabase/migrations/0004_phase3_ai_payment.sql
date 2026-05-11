-- =====================================================================
-- 16STORE — MIGRATION 0004 (Phase 3)
-- AI extract + VietQR payment + campaigns + reputation
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- Mở rộng bảng posts với AI extraction
-- ─────────────────────────────────────────────────────────────────────
alter table public.posts
  add column if not exists ai_extracted jsonb,
  add column if not exists ai_confidence numeric(3, 2),
  add column if not exists ai_risk_flags text[];

create index if not exists idx_posts_ai_confidence on public.posts(ai_confidence);

-- ─────────────────────────────────────────────────────────────────────
-- Mở rộng bảng payments với VietQR/PayOS
-- ─────────────────────────────────────────────────────────────────────
alter table public.payments
  add column if not exists order_code text unique,
  add column if not exists vietqr_url text,
  add column if not exists payos_ref text,
  add column if not exists raw_webhook_payload jsonb;

create index if not exists idx_payments_order_code on public.payments(order_code);

-- ─────────────────────────────────────────────────────────────────────
-- Bảng campaigns — chiến dịch khuyến mãi/sự kiện
-- ─────────────────────────────────────────────────────────────────────
create type campaign_status as enum ('draft', 'scheduled', 'active', 'ended', 'cancelled');

create table if not exists public.campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  status campaign_status not null default 'draft',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_campaigns_status on public.campaigns(status);
create index if not exists idx_campaigns_dates on public.campaigns(starts_at, ends_at);

-- ─────────────────────────────────────────────────────────────────────
-- Bảng pricing_rules — quy tắc tính phí động
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.pricing_rules (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  name text not null,
  conditions jsonb not null default '{}'::jsonb,
  -- VD: {"brand": ["Nike", "Jordan"], "min_price_vnd": 5000000}

  fee_type text not null check (fee_type in ('percent', 'flat')),
  fee_value numeric not null,
  -- percent: 0.12 = 12%; flat: 50000 = 50K VNĐ

  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_pricing_rules_active on public.pricing_rules(is_active, priority desc);

-- ─────────────────────────────────────────────────────────────────────
-- Bảng reputation_log — lịch sử thay đổi điểm uy tín
-- ─────────────────────────────────────────────────────────────────────
create type reputation_reason as enum (
  'post_submitted',
  'post_auto_approved',
  'post_verified_by_hub',
  'post_sold',
  'positive_review',
  'negative_review',
  'dispute_resolved',
  'admin_adjustment',
  'first_pair'
);

create table if not exists public.reputation_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  delta integer not null,
  reason reputation_reason not null,
  related_post_id uuid references public.posts(id) on delete set null,
  related_payment_id uuid references public.payments(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_reputation_user on public.reputation_log(user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────
-- Function atomic cộng điểm uy tín
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.add_reputation(
  p_user_id uuid,
  p_delta integer,
  p_reason reputation_reason,
  p_post_id uuid default null,
  p_payment_id uuid default null,
  p_notes text default null
) returns void as $$
begin
  insert into public.reputation_log (user_id, delta, reason, related_post_id, related_payment_id, notes)
  values (p_user_id, p_delta, p_reason, p_post_id, p_payment_id, p_notes);

  update public.users
  set reputation_score = greatest(0, reputation_score + p_delta)
  where id = p_user_id;
end;
$$ language plpgsql;

-- ─────────────────────────────────────────────────────────────────────
-- Function: tìm phí áp dụng cho 1 post (theo pricing_rules)
-- Trả về fee_amount và campaign_name nếu match rule
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.calculate_listing_fee(
  p_brand text,
  p_asking_price_vnd bigint,
  p_user_id uuid default null
) returns table (
  fee_amount_vnd bigint,
  fee_rate numeric,
  applied_rule_id uuid,
  campaign_name text
) as $$
declare
  v_now timestamptz := now();
  v_rule record;
  v_user_reputation integer := 0;
begin
  if p_user_id is not null then
    select reputation_score into v_user_reputation from public.users where id = p_user_id;
  end if;

  -- Quét pricing_rules theo priority cao → thấp
  for v_rule in
    select pr.*, c.name as campaign_name
    from public.pricing_rules pr
    left join public.campaigns c on c.id = pr.campaign_id
    where pr.is_active = true
      and (c.id is null or (
        c.status = 'active'
        and v_now >= c.starts_at
        and v_now <= c.ends_at
      ))
    order by pr.priority desc
  loop
    -- Check conditions
    if (v_rule.conditions->'brand' is null or
        v_rule.conditions->'brand' ? p_brand) and
       (v_rule.conditions->>'min_price_vnd' is null or
        p_asking_price_vnd >= (v_rule.conditions->>'min_price_vnd')::bigint) and
       (v_rule.conditions->>'min_reputation' is null or
        v_user_reputation >= (v_rule.conditions->>'min_reputation')::integer)
    then
      if v_rule.fee_type = 'percent' then
        return query select
          (p_asking_price_vnd * v_rule.fee_value)::bigint,
          v_rule.fee_value,
          v_rule.id,
          v_rule.campaign_name;
      else
        return query select
          v_rule.fee_value::bigint,
          (v_rule.fee_value / nullif(p_asking_price_vnd, 0))::numeric,
          v_rule.id,
          v_rule.campaign_name;
      end if;
      return;
    end if;
  end loop;

  -- Fallback: 12% mặc định
  return query select
    (p_asking_price_vnd * 0.12)::bigint,
    0.12::numeric,
    null::uuid,
    null::text;
end;
$$ language plpgsql;

-- ─────────────────────────────────────────────────────────────────────
-- RLS cho các bảng mới
-- ─────────────────────────────────────────────────────────────────────
alter table public.campaigns enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.reputation_log enable row level security;

create policy "campaigns_select_active" on public.campaigns
  for select using (status = 'active' or status = 'scheduled');

create policy "pricing_rules_select_active" on public.pricing_rules
  for select using (is_active = true);

create policy "reputation_log_select_self" on public.reputation_log
  for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────
-- SEED: 1 campaign mẫu + 1 pricing rule
-- ─────────────────────────────────────────────────────────────────────
insert into public.campaigns (id, name, description, status, starts_at, ends_at) values
  ('cccc1111-0000-0000-0000-000000000001',
   'Tết 2026 — Sneaker Vintage Discount',
   'Giảm phí ký gửi cho pair vintage (release < 2020)',
   'active',
   '2026-01-15 00:00:00+07',
   '2026-02-28 23:59:59+07')
on conflict (id) do nothing;

insert into public.pricing_rules (campaign_id, name, conditions, fee_type, fee_value, priority, is_active)
values
  ('cccc1111-0000-0000-0000-000000000001',
   'Vintage 8% (giảm từ 12%)',
   '{"min_reputation": 50}'::jsonb,
   'percent', 0.08, 100, true);
