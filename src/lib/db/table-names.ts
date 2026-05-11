// src/lib/db/table-names.ts
// Centralized table name constants — merge-ready design.
// Khi hợp nhất HLRace + 16Store, chỉ cần rename các values ở đây.
//
// Example: khi merge sẽ đổi:
//   SHOE_PASSPORTS: 'shoe_passports'  →  'shop_passports'
// Code sử dụng TABLES.SHOE_PASSPORTS sẽ tự động update khắp project.

export const TABLES = {
  // ─── Core (sẽ shared sau merge) ───
  USERS: 'users',
  PLATFORM_SETTINGS: 'platform_settings',
  ACTIVITY_LOG: 'activity_log',
  SPONSORS: 'sponsors',

  // ─── 16Store (sẽ prefix 'shop_' sau merge) ───
  POSTS: 'posts',
  LOTS: 'lots',
  HUBS: 'hubs',
  SHOE_PASSPORTS: 'shoe_passports',
  OWNERSHIP_HISTORY: 'ownership_history',
  SCAN_EVENTS: 'scan_events',
  LOST_REPORTS: 'lost_reports',
  FAVORITES: 'favorites',

  // ─── Social Card AI (Sprint 3) ───
  SOCIAL_CARDS: 'social_cards',
  SOCIAL_CARD_RATE_LIMITS: 'social_card_rate_limits',
  SOCIAL_CARD_USAGE_TRACKING: 'social_card_usage_tracking',
  AFFILIATE_CLICKS: 'affiliate_clicks',
  AFFILIATE_CREDITS: 'affiliate_credits',
} as const;

// Views (read-only projections of tables)
export const VIEWS = {
  POSTS_WITH_SELLER: 'posts_with_seller',
} as const;

// RPC function names (stored procedures)
export const RPC = {
  CHECK_SOCIAL_CARD_RATE_LIMIT: 'check_social_card_rate_limit',
  CHECK_SOCIAL_CARD_GLOBAL_LIMITS: 'check_social_card_global_limits',
  LOG_SOCIAL_CARD_USAGE: 'log_social_card_usage',
  INCREMENT_SOCIAL_CARD_STATS: 'increment_social_card_stats',
  INCREMENT_POST_VIEWS: 'increment_post_views',
} as const;

// Storage buckets
export const BUCKETS = {
  SNEAKER_PHOTOS: 'sneaker-photos',
  SOCIAL_CARDS: 'social-cards',
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];
export type ViewName = (typeof VIEWS)[keyof typeof VIEWS];
export type RpcName = (typeof RPC)[keyof typeof RPC];
export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];
