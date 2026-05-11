-- ============================================================================
-- MIGRATION 0010 — SPRINT 3: SOCIAL CARD AI + AFFILIATE TRACKING
-- ============================================================================
-- Chạy trên Supabase SQL Editor (không phải CLI)
-- Bước 1: Copy toàn bộ file này
-- Bước 2: Paste vào Supabase Dashboard → SQL Editor → Run
-- Bước 3: Verify bằng query cuối file (SELECT ... FROM pg_tables WHERE ...)
-- ============================================================================

-- ====================
-- TABLE 1: social_cards
-- ====================
-- Lưu mỗi poster đã generate. Dùng cho cache (tránh regenerate trùng)
-- và history (user xem lại các poster đã tạo).
CREATE TABLE IF NOT EXISTS social_cards (
  id TEXT PRIMARY KEY DEFAULT ('sc_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12)),

  -- Link đến pair & user
  passport_id TEXT NOT NULL REFERENCES shoe_passports(id) ON DELETE CASCADE,
  post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
  creator_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Style config (để cache key)
  style TEXT NOT NULL CHECK (style IN ('editorial', 'street', 'archive')),
  tagline_lang TEXT NOT NULL DEFAULT 'vi' CHECK (tagline_lang IN ('vi', 'en')),

  -- AI outputs (cached)
  ai_tagline TEXT,                          -- AI-generated story caption
  background_prompt TEXT,                   -- Prompt đã gửi Gemini Image
  background_url TEXT,                      -- Supabase Storage path (raw background)

  -- Final composited poster
  poster_url TEXT NOT NULL,                 -- Full poster URL (Supabase Storage)
  poster_width INTEGER NOT NULL DEFAULT 1080,
  poster_height INTEGER NOT NULL DEFAULT 1350,

  -- Affiliate config
  affiliate_enabled BOOLEAN NOT NULL DEFAULT true,
  affiliate_code TEXT,                      -- Same as creator_user_id (short form ref)

  -- Stats (update realtime khi scan)
  view_count INTEGER NOT NULL DEFAULT 0,
  scan_count INTEGER NOT NULL DEFAULT 0,   -- Số lần QR bị scan
  share_count INTEGER NOT NULL DEFAULT 0,  -- Số lần user click share button

  -- Cache control
  cache_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_cards_passport ON social_cards(passport_id);
CREATE INDEX IF NOT EXISTS idx_social_cards_creator ON social_cards(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_social_cards_cache_lookup
  ON social_cards(passport_id, style, tagline_lang, creator_user_id)
  WHERE cache_expires_at > NOW();
CREATE INDEX IF NOT EXISTS idx_social_cards_created ON social_cards(created_at DESC);

COMMENT ON TABLE social_cards IS 'Sprint 3: AI-generated social posters với affiliate tracking';


-- ==================================
-- TABLE 2: social_card_rate_limits
-- ==================================
-- Throttle số lần user tạo poster để tránh abuse Gemini API cost.
-- Default: 3 posters/pair/day/user. Reset mỗi 24h rolling.
CREATE TABLE IF NOT EXISTS social_card_rate_limits (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  passport_id TEXT NOT NULL REFERENCES shoe_passports(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrl_lookup
  ON social_card_rate_limits(user_id, passport_id, attempted_at DESC);

COMMENT ON TABLE social_card_rate_limits IS 'Sprint 3: Rate limit cho social card generation';


-- ============================
-- TABLE 3: affiliate_clicks
-- ============================
-- Track funnel: ai scan QR poster → đến passport page → chuyển tiếp đâu.
-- Insert mỗi lần user scan 1 QR poster có ref param.
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id BIGSERIAL PRIMARY KEY,

  -- Referrer (user share poster)
  referrer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- What was shared
  passport_id TEXT REFERENCES shoe_passports(id) ON DELETE SET NULL,
  social_card_id TEXT REFERENCES social_cards(id) ON DELETE SET NULL,

  -- Who clicked (có thể null nếu chưa login)
  clicker_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  clicker_session_id TEXT,                  -- Anonymous session tracking
  clicker_ip_hash TEXT,                     -- Hashed IP (privacy)
  clicker_user_agent TEXT,
  clicker_country TEXT,
  clicker_city TEXT,

  -- Funnel state
  converted_to_purchase BOOLEAN DEFAULT false,
  purchase_post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
  purchase_amount_vnd BIGINT,

  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_aff_clicks_referrer ON affiliate_clicks(referrer_user_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_aff_clicks_passport ON affiliate_clicks(passport_id);
CREATE INDEX IF NOT EXISTS idx_aff_clicks_converted ON affiliate_clicks(converted_to_purchase, clicked_at DESC);

COMMENT ON TABLE affiliate_clicks IS 'Sprint 3: Track clicks trên social card QR links';


-- =============================
-- TABLE 4: affiliate_credits
-- =============================
-- Ledger của commission cho người share poster.
-- Mỗi row = 1 lần có ai mua hàng qua link affiliate của họ.
CREATE TABLE IF NOT EXISTS affiliate_credits (
  id BIGSERIAL PRIMARY KEY,

  referrer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  click_id BIGINT REFERENCES affiliate_clicks(id) ON DELETE SET NULL,

  -- Transaction info
  post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
  passport_id TEXT REFERENCES shoe_passports(id) ON DELETE SET NULL,
  purchase_amount_vnd BIGINT NOT NULL,
  commission_rate_bps INTEGER NOT NULL DEFAULT 300,  -- 3.00% = 300 basis points
  commission_amount_vnd BIGINT NOT NULL,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'paid_out', 'cancelled')),
  confirmed_at TIMESTAMPTZ,
  paid_out_at TIMESTAMPTZ,
  payout_reference TEXT,                    -- Bank transfer ref khi trả tiền

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aff_credits_referrer ON affiliate_credits(referrer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aff_credits_status ON affiliate_credits(status, created_at DESC);

COMMENT ON TABLE affiliate_credits IS 'Sprint 3: Ledger của affiliate commissions';


-- ====================================
-- RPC: check_social_card_rate_limit
-- ====================================
-- Return: JSONB { allowed: bool, remaining: int, reset_at: timestamptz }
CREATE OR REPLACE FUNCTION check_social_card_rate_limit(
  p_user_id TEXT,
  p_passport_id TEXT,
  p_limit INTEGER DEFAULT 3,
  p_window_hours INTEGER DEFAULT 24
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_oldest TIMESTAMPTZ;
BEGIN
  -- Đếm số lần attempt trong window
  SELECT COUNT(*), MIN(attempted_at)
    INTO v_count, v_oldest
  FROM social_card_rate_limits
  WHERE user_id = p_user_id
    AND passport_id = p_passport_id
    AND attempted_at > NOW() - (p_window_hours || ' hours')::INTERVAL;

  IF v_count >= p_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'used', v_count,
      'limit', p_limit,
      'reset_at', v_oldest + (p_window_hours || ' hours')::INTERVAL
    );
  END IF;

  -- Log attempt
  INSERT INTO social_card_rate_limits (user_id, passport_id)
  VALUES (p_user_id, p_passport_id);

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', p_limit - v_count - 1,
    'used', v_count + 1,
    'limit', p_limit,
    'reset_at', NULL
  );
END;
$$;

COMMENT ON FUNCTION check_social_card_rate_limit IS
'Sprint 3: Check + increment rate limit. Return JSONB.';


-- ====================================
-- RPC: increment_social_card_stats
-- ====================================
-- Dùng khi có scan/share/view — update counter atomic
CREATE OR REPLACE FUNCTION increment_social_card_stats(
  p_card_id TEXT,
  p_stat TEXT  -- 'view' | 'scan' | 'share'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_stat = 'view' THEN
    UPDATE social_cards SET view_count = view_count + 1, updated_at = NOW() WHERE id = p_card_id;
  ELSIF p_stat = 'scan' THEN
    UPDATE social_cards SET scan_count = scan_count + 1, updated_at = NOW() WHERE id = p_card_id;
  ELSIF p_stat = 'share' THEN
    UPDATE social_cards SET share_count = share_count + 1, updated_at = NOW() WHERE id = p_card_id;
  END IF;
END;
$$;


-- ================================
-- PLATFORM SETTINGS cho Sprint 3
-- ================================
-- Insert mới nếu chưa có, update nếu đã tồn tại
INSERT INTO platform_settings (key, value, value_type, category, description, updated_by)
VALUES
  ('social_card_rate_limit_per_day',     '3',    'number',  'features',
   'Số poster tối đa user có thể tạo cho 1 pair/ngày', 'user_14856054'),

  ('social_card_cache_days',             '7',    'number',  'features',
   'Số ngày cache 1 poster (tránh regenerate)', 'user_14856054'),

  ('affiliate_commission_rate_bps',      '300',  'number',  'features',
   'Commission rate cho affiliate (basis points, 300 = 3%)', 'user_14856054'),

  ('affiliate_cookie_days',              '30',   'number',  'features',
   'Số ngày cookie affiliate_ref valid', 'user_14856054'),

  ('gemini_image_model',                 'gemini-2.5-flash-image',  'string',  'features',
   'Model dùng để generate background', 'user_14856054'),

  ('gemini_tagline_model',               'gemini-2.5-flash',        'string',  'features',
   'Model dùng để generate AI tagline', 'user_14856054'),

  ('social_card_enabled',                'true',   'boolean', 'features',
   'Bật/tắt feature Social Card AI toàn platform', 'user_14856054')

ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();


-- ================================
-- SUPABASE STORAGE BUCKET
-- ================================
-- Note: Phải tạo bucket qua Supabase Dashboard (GUI) hoặc storage API,
-- KHÔNG tạo qua SQL (permission restrictions).
--
-- Hướng dẫn manual sau khi chạy SQL này:
-- 1. Vào Supabase Dashboard → Storage → New bucket
-- 2. Name: "social-cards"
-- 3. Public: YES (để poster access không cần auth token)
-- 4. File size limit: 5 MB
-- 5. Allowed MIME types: image/png, image/jpeg, image/webp
--
-- Alternative: Tôi sẽ dùng base64 data URL tạm nếu bucket chưa tạo,
-- để test local trước khi setup storage production.


-- ================================
-- VERIFY MIGRATION
-- ================================
-- Chạy query này sau khi chạy migration để check:
SELECT
  tablename,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = t.tablename) AS index_count
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN ('social_cards', 'social_card_rate_limits', 'affiliate_clicks', 'affiliate_credits')
ORDER BY tablename;

-- Expected result: 4 rows, mỗi table có ≥1 index
-- social_cards (4 indexes), social_card_rate_limits (2), affiliate_clicks (3+), affiliate_credits (2+)


-- Verify settings
SELECT key, value, value_type, category
FROM platform_settings
WHERE key LIKE '%social_card%' OR key LIKE '%affiliate%' OR key LIKE '%gemini%'
ORDER BY key;

-- Expected: 7 rows mới thêm

-- ============================================================================
-- END OF MIGRATION 0010
-- ============================================================================
