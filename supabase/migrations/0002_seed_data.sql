-- =====================================================================
-- 16STORE — SEED DATA
-- Run this AFTER 0001_init_schema_v2.sql
-- Creates: 4 hubs, 6 mock users, ~12 posts, 3 sample payments
-- =====================================================================
--
-- NOTE: Vì users.id ref tới auth.users, trong seed này chúng ta tạo
-- auth users trước qua admin API hoặc dùng UUID giả định.
-- Để đơn giản cho dev/test, ta sẽ DISABLE FK tạm thời rồi insert mock data.
--
-- KHI DEPLOY THẬT: bỏ phần insert users, để Supabase Auth tự tạo qua signup.
-- =====================================================================

-- Tạm tắt FK constraint để insert mock auth users
set session_replication_role = 'replica';

-- ─────────────────────────────────────────────────────────────────────
-- MOCK AUTH USERS (chỉ dùng cho dev seed)
-- ─────────────────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'duy@16store.dev', '{"handle":"duy_archive"}'),
  ('22222222-2222-2222-2222-222222222222', 'hieu@16store.dev', '{"handle":"hieunguyen"}'),
  ('33333333-3333-3333-3333-333333333333', 'minh@16store.dev', '{"handle":"minhsneaker"}'),
  ('44444444-4444-4444-4444-444444444444', 'kanye@16store.dev', '{"handle":"kanyewest_vn"}'),
  ('55555555-5555-5555-5555-555555555555', 'cactus@16store.dev', '{"handle":"cactusjack_hcm"}'),
  ('66666666-6666-6666-6666-666666666666', 'af1@16store.dev', '{"handle":"af1_collector"}'),
  ('77777777-7777-7777-7777-777777777777', 'long@16store.dev', '{"handle":"longnguyen"}'),
  ('88888888-8888-8888-8888-888888888888', 'admin_thaiha@16store.dev', '{"handle":"admin_thaiha"}')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- HUBS (4 hubs khớp design)
-- ─────────────────────────────────────────────────────────────────────
insert into public.hubs (id, code, name, city, address, lat, lng, status, active_lots, capacity, verifier_count, opens_at, closes_at) values
  ('aaaa1111-0000-0000-0000-000000000001', 'HN_THAIHA', 'Thái Hà', 'Hà Nội', '163 Thái Hà, Đống Đa, Hà Nội', 21.0117, 105.8198, 'open', 24, 800, 4, '09:00', '21:00'),
  ('aaaa2222-0000-0000-0000-000000000002', 'SGN_Q1', 'Q.1 Saigon', 'TP. Hồ Chí Minh', '42 Pasteur, P. Bến Nghé, Q.1', 10.7769, 106.7009, 'busy', 18, 600, 3, '09:00', '22:00'),
  ('aaaa3333-0000-0000-0000-000000000003', 'DN', 'Đà Nẵng', 'Đà Nẵng', '88 Lê Duẩn, Hải Châu, Đà Nẵng', 16.0667, 108.2208, 'open', 9, 300, 2, '09:30', '20:30'),
  ('aaaa4444-0000-0000-0000-000000000004', 'CTO', 'Cần Thơ', 'Cần Thơ', '15 Trần Văn Khéo, Ninh Kiều, Cần Thơ', 10.0319, 105.7779, 'closed', 4, 200, 1, '10:00', '20:00')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- USERS (public.users — auto created by trigger nhưng ta override values)
-- ─────────────────────────────────────────────────────────────────────
insert into public.users (id, handle, display_name, role, reputation_score, total_pairs_sold, total_volume_vnd, hub_id, bio) values
  ('11111111-1111-1111-1111-111111111111', 'duy_archive', 'Duy Archive', 'seller', 482, 47, 248000000, null, 'AJ collector since 2018. Only DS pairs.'),
  ('22222222-2222-2222-2222-222222222222', 'hieunguyen', 'Hiếu Nguyễn', 'seller', 156, 12, 64000000, null, 'SB Dunk specialist'),
  ('33333333-3333-3333-3333-333333333333', 'minhsneaker', 'Minh Sneaker', 'seller', 892, 124, 612000000, null, 'NB Made in USA · NB Made in UK only'),
  ('44444444-4444-4444-4444-444444444444', 'kanyewest_vn', 'Kanye West VN', 'seller', 234, 28, 142000000, null, 'Yeezy archive 2015-2024'),
  ('55555555-5555-5555-5555-555555555555', 'cactusjack_hcm', 'Cactus Jack HCM', 'seller', 567, 19, 386000000, null, 'Travis Scott exclusive'),
  ('66666666-6666-6666-6666-666666666666', 'af1_collector', 'AF1 Collector', 'seller', 78, 8, 24000000, null, 'AF1 only. 100+ pairs in vault.'),
  ('77777777-7777-7777-7777-777777777777', 'longnguyen', 'Long Nguyễn', 'buyer', 45, 0, 0, null, ''),
  ('88888888-8888-8888-8888-888888888888', 'admin_thaiha', 'Admin Thái Hà', 'hub_admin', 0, 0, 0, 'aaaa1111-0000-0000-0000-000000000001', 'Hub lead Thái Hà')
on conflict (id) do update set
  handle = excluded.handle,
  display_name = excluded.display_name,
  role = excluded.role,
  reputation_score = excluded.reputation_score,
  total_pairs_sold = excluded.total_pairs_sold,
  total_volume_vnd = excluded.total_volume_vnd,
  hub_id = excluded.hub_id,
  bio = excluded.bio;

-- ─────────────────────────────────────────────────────────────────────
-- POSTS (12 listings — 6 featured + 6 floor)
-- ─────────────────────────────────────────────────────────────────────
insert into public.posts (
  lot_id, seller_id, hub_id, brand, model, colorway, size_us, condition, release_year,
  asking_price_vnd, reserve_price_vnd, market_avg_vnd,
  status, image_urls, cover_image_url,
  verify_stitching, verify_sole, verify_materials, verify_box, verified_at, verified_by,
  view_count, is_featured, listed_at
) values
  -- Featured drops (6 đầu)
  ('A-481', '11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000001',
   'Air Jordan', 'AJ4 Bred Reimagined', 'Bred', 9.5, 'DS', 2024,
   6800000, 6500000, 7000000,
   'live', array['/sneakers/aj4-bred.jpg'], '/sneakers/aj4-bred.jpg',
   true, true, true, true, now() - interval '2 hours', '88888888-8888-8888-8888-888888888888',
   142, true, now() - interval '1 day'),

  ('B-203', '22222222-2222-2222-2222-222222222222', 'aaaa2222-0000-0000-0000-000000000002',
   'Nike SB', 'SB Dunk Low Panda', 'Black/White', 10, 'VNDS', 2023,
   4200000, 4000000, 4050000,
   'live', array['/sneakers/sb-panda.jpg'], '/sneakers/sb-panda.jpg',
   true, true, true, false, now() - interval '5 hours', '88888888-8888-8888-8888-888888888888',
   89, true, now() - interval '2 days'),

  ('V-016', '33333333-3333-3333-3333-333333333333', 'aaaa3333-0000-0000-0000-000000000003',
   'New Balance', 'NB 990v3', 'Steel Blue', 9, 'DS', 2023,
   5400000, 5200000, 5400000,
   'live', array['/sneakers/nb-990v3.jpg'], '/sneakers/nb-990v3.jpg',
   true, true, true, true, now() - interval '1 day', '88888888-8888-8888-8888-888888888888',
   234, true, now() - interval '3 days'),

  ('A-512', '44444444-4444-4444-4444-444444444444', 'aaaa1111-0000-0000-0000-000000000001',
   'Yeezy', 'Yeezy Boost 350 V2', 'Bred', 9, '9_5', 2020,
   5900000, 5500000, 6300000,
   'live', array['/sneakers/yeezy-bred.jpg'], '/sneakers/yeezy-bred.jpg',
   true, true, true, true, now() - interval '6 hours', '88888888-8888-8888-8888-888888888888',
   178, true, now() - interval '12 hours'),

  ('B-340', '55555555-5555-5555-5555-555555555555', 'aaaa2222-0000-0000-0000-000000000002',
   'Travis Scott', 'AJ1 Travis Scott Olive', 'Mocha/Olive', 10.5, 'DS', 2022,
   14500000, 14000000, 13300000,
   'live', array['/sneakers/aj1-ts-olive.jpg'], '/sneakers/aj1-ts-olive.jpg',
   true, true, true, true, now() - interval '8 hours', '88888888-8888-8888-8888-888888888888',
   312, true, now() - interval '4 days'),

  ('V-029', '66666666-6666-6666-6666-666666666666', 'aaaa4444-0000-0000-0000-000000000004',
   'Nike', 'AF1 Low Cobalt Drift', 'Cobalt Blue', 11, 'DS', 2024,
   3100000, 3000000, 3100000,
   'live', array['/sneakers/af1-cobalt.jpg'], '/sneakers/af1-cobalt.jpg',
   true, true, true, true, now() - interval '12 hours', '88888888-8888-8888-8888-888888888888',
   67, true, now() - interval '5 days'),

  -- Floor listings (more variety — for the live feed)
  ('A-501', '11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000001',
   'Air Jordan', 'AJ1 High Chicago Lost & Found', 'Red/White', 9, 'DS', 2022,
   18500000, 18000000, 19000000,
   'live', array['/sneakers/aj1-chicago.jpg'], '/sneakers/aj1-chicago.jpg',
   true, true, true, true, now() - interval '2 days', '88888888-8888-8888-8888-888888888888',
   523, false, now() - interval '6 days'),

  ('B-244', '22222222-2222-2222-2222-222222222222', 'aaaa2222-0000-0000-0000-000000000002',
   'Nike SB', 'SB Dunk Low Chunky Dunky', 'Brown/White', 9.5, 'VNDS', 2020,
   12800000, 12000000, 13500000,
   'live', array['/sneakers/sb-chunky.jpg'], '/sneakers/sb-chunky.jpg',
   true, true, true, false, now() - interval '3 days', '88888888-8888-8888-8888-888888888888',
   189, false, now() - interval '4 days'),

  ('V-031', '33333333-3333-3333-3333-333333333333', 'aaaa3333-0000-0000-0000-000000000003',
   'New Balance', 'NB 2002R Protection Pack', 'Rain Cloud', 10, 'DS', 2023,
   4800000, 4600000, 4900000,
   'live', array['/sneakers/nb-2002r.jpg'], '/sneakers/nb-2002r.jpg',
   true, true, true, true, now() - interval '1 day', '88888888-8888-8888-8888-888888888888',
   145, false, now() - interval '2 days'),

  ('A-520', '44444444-4444-4444-4444-444444444444', 'aaaa1111-0000-0000-0000-000000000001',
   'Yeezy', 'Yeezy 700 Wave Runner', 'Solid Grey', 9.5, '9_5', 2019,
   6200000, 5800000, 6500000,
   'live', array['/sneakers/yeezy-700.jpg'], '/sneakers/yeezy-700.jpg',
   true, true, true, true, now() - interval '4 days', '88888888-8888-8888-8888-888888888888',
   201, false, now() - interval '7 days'),

  ('B-355', '55555555-5555-5555-5555-555555555555', 'aaaa2222-0000-0000-0000-000000000002',
   'Travis Scott', 'AJ1 Low Reverse Mocha', 'Mocha', 10, 'DS', 2022,
   16800000, 16000000, 17500000,
   'reserved', array['/sneakers/aj1-low-reverse-mocha.jpg'], '/sneakers/aj1-low-reverse-mocha.jpg',
   true, true, true, true, now() - interval '2 days', '88888888-8888-8888-8888-888888888888',
   456, false, now() - interval '5 days'),

  ('V-035', '66666666-6666-6666-6666-666666666666', 'aaaa4444-0000-0000-0000-000000000004',
   'Nike', 'AF1 Low Triple White', 'White', 10.5, 'DS', 2024,
   2500000, 2400000, 2600000,
   'live', array['/sneakers/af1-white.jpg'], '/sneakers/af1-white.jpg',
   true, true, true, true, now() - interval '6 hours', '88888888-8888-8888-8888-888888888888',
   34, false, now() - interval '1 day');

-- ─────────────────────────────────────────────────────────────────────
-- QR CODES (one per post + one hub intake)
-- ─────────────────────────────────────────────────────────────────────
insert into public.qr_codes (code, purpose, post_id, hub_id, is_active, metadata)
select
  '16S:LOT:' || p.lot_id || ':' || substr(md5(p.id::text), 1, 8),
  'lot_tag'::qr_purpose,
  p.id,
  p.hub_id,
  true,
  jsonb_build_object('lot_id', p.lot_id, 'brand', p.brand, 'model', p.model)
from public.posts p;

-- Hub intake QRs (one per active hub)
insert into public.qr_codes (code, purpose, hub_id, is_active, metadata) values
  ('16S:HUB:HN_THAIHA:intake', 'hub_intake', 'aaaa1111-0000-0000-0000-000000000001', true, '{"label":"Hub Thái Hà · Intake station"}'::jsonb),
  ('16S:HUB:SGN_Q1:intake',    'hub_intake', 'aaaa2222-0000-0000-0000-000000000002', true, '{"label":"Hub Q.1 SGN · Intake station"}'::jsonb),
  ('16S:HUB:DN:intake',        'hub_intake', 'aaaa3333-0000-0000-0000-000000000003', true, '{"label":"Hub Đà Nẵng · Intake station"}'::jsonb);

-- ─────────────────────────────────────────────────────────────────────
-- PAYMENTS (3 sample — 1 cleared, 1 held, 1 pending)
-- ─────────────────────────────────────────────────────────────────────
insert into public.payments (
  post_id, buyer_id, seller_id,
  gross_amount_vnd, platform_fee_vnd, seller_payout_vnd, fee_rate,
  status, payment_method, held_at, cleared_at, payout_reference
)
select
  (select id from public.posts where lot_id = 'B-355'),
  '77777777-7777-7777-7777-777777777777',
  '55555555-5555-5555-5555-555555555555',
  16800000, 2016000, 14784000, 0.12,
  'cleared', 'bank_transfer',
  now() - interval '3 days', now() - interval '1 day', 'VCB-20260418-A481';

insert into public.payments (
  post_id, buyer_id, seller_id,
  gross_amount_vnd, platform_fee_vnd, seller_payout_vnd, fee_rate,
  status, payment_method, held_at
)
select
  (select id from public.posts where lot_id = 'V-031'),
  '77777777-7777-7777-7777-777777777777',
  '33333333-3333-3333-3333-333333333333',
  4800000, 576000, 4224000, 0.12,
  'held', 'momo',
  now() - interval '6 hours';

-- Re-enable FK constraints
set session_replication_role = 'origin';

-- ─────────────────────────────────────────────────────────────────────
-- UPDATE hub active_lots based on actual posts
-- ─────────────────────────────────────────────────────────────────────
update public.hubs h set active_lots = (
  select count(*) from public.posts p
  where p.hub_id = h.id and p.status in ('live', 'reserved', 'pending_verify')
);
