-- =====================================================================
-- 16STORE — MIGRATION 0003
-- Thêm hỗ trợ Telegram bot và một số cải tiến cho Giai đoạn 2
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- Thêm cột Telegram vào users
-- ─────────────────────────────────────────────────────────────────────
alter table public.users
  add column if not exists telegram_chat_id bigint,
  add column if not exists telegram_username text,
  add column if not exists notifications_enabled boolean not null default true;

create index if not exists idx_users_telegram on public.users(telegram_chat_id);

-- ─────────────────────────────────────────────────────────────────────
-- Bảng telegram_link_tokens
-- Khi user click "Liên kết Telegram", sinh 1 token ngắn hạn.
-- User gửi token đó cho bot, bot dùng token để liên kết chat_id với user.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.telegram_link_tokens (
  id uuid primary key default uuid_generate_v4(),
  token text unique not null,
  user_id uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_telegram_tokens_token on public.telegram_link_tokens(token);

-- ─────────────────────────────────────────────────────────────────────
-- Bảng notifications — log lại tất cả thông báo đã gửi
-- Hữu ích để debug + cho phép user xem lịch sử notification trên web
-- ─────────────────────────────────────────────────────────────────────
create type notification_channel as enum ('telegram', 'email', 'in_app');
create type notification_event as enum (
  'post_submitted',
  'post_received_by_hub',
  'post_verified',
  'post_listed',
  'post_sold',
  'post_rejected',
  'payment_held',
  'payment_cleared'
);

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  channel notification_channel not null,
  event notification_event not null,
  payload jsonb not null default '{}'::jsonb,
  message text not null,
  delivered boolean not null default false,
  delivered_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);

-- RLS cho notifications
alter table public.notifications enable row level security;
create policy "notifications_select_self" on public.notifications
  for select using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────
-- Function: tự sinh lot_id duy nhất
-- Format: <prefix>-<3 chữ số>
-- Prefix: A (Air Jordan/Nike), B (SB/Boutique), V (Vault/cũ), Y (Yeezy)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.generate_lot_id(p_brand text, p_release_year integer)
returns text as $$
declare
  v_prefix text;
  v_number integer;
  v_lot_id text;
  v_attempts integer := 0;
begin
  -- Chọn prefix dựa vào brand + age
  if p_release_year is not null and p_release_year < 2020 then
    v_prefix := 'V';  -- Vault cho hàng cũ
  elsif p_brand ilike '%yeezy%' then
    v_prefix := 'Y';
  elsif p_brand ilike '%jordan%' or p_brand ilike '%air jordan%' then
    v_prefix := 'A';
  elsif p_brand ilike '%sb%' or p_brand ilike '%dunk%' or p_brand ilike '%travis%' then
    v_prefix := 'B';
  else
    v_prefix := 'A';
  end if;

  -- Sinh số ngẫu nhiên + check unique, retry tối đa 10 lần
  loop
    v_number := 100 + floor(random() * 900)::integer;
    v_lot_id := v_prefix || '-' || v_number::text;
    if not exists (select 1 from public.posts where lot_id = v_lot_id) then
      return v_lot_id;
    end if;
    v_attempts := v_attempts + 1;
    if v_attempts > 10 then
      -- Fallback dùng timestamp để chắc chắn unique
      return v_prefix || '-' || (extract(epoch from now())::bigint % 100000)::text;
    end if;
  end loop;
end;
$$ language plpgsql;

-- ─────────────────────────────────────────────────────────────────────
-- Function: tự tạo QR code khi pair mới được insert
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.auto_create_qr_for_post()
returns trigger as $$
begin
  insert into public.qr_codes (code, purpose, post_id, hub_id, is_active, metadata)
  values (
    '16S:LOT:' || new.lot_id || ':' || substr(md5(new.id::text || random()::text), 1, 8),
    'lot_tag'::qr_purpose,
    new.id,
    new.hub_id,
    true,
    jsonb_build_object('lot_id', new.lot_id, 'brand', new.brand, 'model', new.model)
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists post_auto_qr on public.posts;
create trigger post_auto_qr
  after insert on public.posts
  for each row execute function public.auto_create_qr_for_post();

-- ─────────────────────────────────────────────────────────────────────
-- Function: cập nhật hub.active_lots khi post thay đổi
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.update_hub_active_lots()
returns trigger as $$
begin
  -- Cập nhật cho hub cũ (nếu UPDATE và hub_id thay đổi, hoặc DELETE)
  if (tg_op = 'UPDATE' and old.hub_id is distinct from new.hub_id) or tg_op = 'DELETE' then
    if old.hub_id is not null then
      update public.hubs set active_lots = (
        select count(*) from public.posts
        where hub_id = old.hub_id and status in ('live', 'reserved', 'pending_verify')
      ) where id = old.hub_id;
    end if;
  end if;

  -- Cập nhật cho hub mới
  if tg_op in ('INSERT', 'UPDATE') and new.hub_id is not null then
    update public.hubs set active_lots = (
      select count(*) from public.posts
      where hub_id = new.hub_id and status in ('live', 'reserved', 'pending_verify')
    ) where id = new.hub_id;
  end if;

  return null;
end;
$$ language plpgsql;

drop trigger if exists post_hub_count on public.posts;
create trigger post_hub_count
  after insert or update or delete on public.posts
  for each row execute function public.update_hub_active_lots();

-- ─────────────────────────────────────────────────────────────────────
-- STORAGE BUCKET cho ảnh sneaker
-- (Chạy thủ công trong Supabase Dashboard → Storage → Create bucket
--  hoặc chạy lệnh dưới qua SQL Editor)
-- ─────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('sneaker-photos', 'sneaker-photos', true)
on conflict (id) do nothing;

-- Cho phép user upload ảnh (chỉ vào folder của mình)
create policy "users_upload_own_photos"
  on storage.objects for insert
  with check (
    bucket_id = 'sneaker-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "anyone_view_sneaker_photos"
  on storage.objects for select
  using (bucket_id = 'sneaker-photos');

create policy "users_delete_own_photos"
  on storage.objects for delete
  using (
    bucket_id = 'sneaker-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
