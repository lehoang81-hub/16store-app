// src/lib/social-card/config.ts
// Sprint 3: Hardcoded config. TODO: migrate sang platform_settings sau khi Sprint 3 stable.

export const SOCIAL_CARD_CONFIG = {
  // Rate limiting
  RATE_LIMIT_PER_DAY: 3,
  RATE_LIMIT_WINDOW_HOURS: 24,

  // Cache
  CACHE_DAYS: 7,

  // Affiliate
  COMMISSION_RATE_BPS: 300, // 3.00%
  COOKIE_DAYS: 30,

  // Poster dimensions (Instagram portrait 4:5)
  POSTER_WIDTH: 1080,
  POSTER_HEIGHT: 1350,

  // Gemini models
  MODEL_IMAGE: 'gemini-2.5-flash-image',
  MODEL_TEXT: 'gemini-2.5-flash',

  // Storage
  STORAGE_BUCKET: 'social-cards',

  // Base URL for QR code (poster sẽ có QR link về đây)
  // Format: {APP_URL}/p/{passport_qr_code}?ref={user_id}
  // Route /p/... sẽ redirect sang /passport/... và set cookie affiliate
  QR_BASE_PATH: '/p',
} as const;

export const SOCIAL_CARD_STYLES = ['editorial', 'street', 'archive'] as const;
export type SocialCardStyle = (typeof SOCIAL_CARD_STYLES)[number];

export const TAGLINE_LANGS = ['vi', 'en'] as const;
export type TaglineLang = (typeof TAGLINE_LANGS)[number];
