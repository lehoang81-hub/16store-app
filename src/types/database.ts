// =====================================================================
// DATABASE TYPES — Phase 1 Schema mới
// Mapping: backup → schema mới
// =====================================================================

export type UserRole = 'seller' | 'buyer' | 'hub_admin' | 'super_admin';
export type PostStatus = 'draft' | 'pending_payment' | 'pending_verify' | 'live' | 'reserved' | 'sold' | 'rejected' | 'withdrawn';
export type PostCondition = 'DS' | 'VNDS' | '9_5' | '9' | '8_5' | '8';
export type PaymentStatus = 'pending' | 'held' | 'cleared' | 'refunded' | 'failed';
export type HubStatus = 'open' | 'busy' | 'closed' | 'setup';
export type QrPurpose = 'lot_tag' | 'hub_intake' | 'verify_step' | 'payout_receipt';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'ended' | 'cancelled';
export type AcquisitionType = 'first_purchase' | 'transfer' | 'gift' | 'inheritance';

export interface User {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  reputation_score: number;
  total_pairs_sold: number;
  total_volume_vnd: number;
  hub_id: string | null;       // Hub user đang quản lý (thay thế managed_by_user_id ở bảng hubs)
  bio: string | null;
  telegram_chat_id: number | null;
  telegram_username: string | null;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Hub {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  lat: number | null;
  lng: number | null;
  status: HubStatus;
  active_lots: number;
  capacity: number;
  verifier_count: number;
  opens_at: string | null;
  closes_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  lot_id: string;
  seller_id: string;
  hub_id: string | null;
  brand: string;
  model: string;
  colorway: string | null;
  size_us: number;
  condition: PostCondition;
  release_year: number | null;
  asking_price_vnd: number;
  reserve_price_vnd: number | null;
  market_avg_vnd: number | null;
  status: PostStatus;
  image_urls: string[];
  cover_image_url: string | null;
  verify_stitching: boolean;
  verify_sole: boolean;
  verify_materials: boolean;
  verify_box: boolean;
  verified_at: string | null;
  verified_by: string | null;
  view_count: number;
  is_featured: boolean;
  listed_at: string | null;
  sold_at: string | null;
  ai_extracted: Record<string, unknown> | null;
  ai_confidence: number | null;
  ai_risk_flags: string[] | null;
  created_at: string;
  updated_at: string;
}

/**
 * Shoe Passport — Schema mới
 * Mapping thay đổi so với backup:
 * - current_post_id → post_id
 * - current_owner_id → owner_id
 * - status → is_lost (boolean)
 * - privacy_mode (column) → asset_metadata.privacy_mode (JSONB)
 * - total_scans → COUNT từ scan_events
 * - total_owners → COUNT từ ownership_history
 */
export interface ShoePassport {
  id: string;
  qr_code: string;
  post_id: string | null;          // Schema mới (backup: current_post_id)
  owner_id: string | null;         // Schema mới (backup: current_owner_id)
  brand: string;
  model: string;
  colorway: string | null;
  size_us: number;
  condition: PostCondition;
  year: number | null;
  is_lost: boolean;                // Schema mới: boolean (backup: status='lost')
  lost_at: string | null;
  found_at: string | null;
  journey_score: number;
  journey_log: Record<string, unknown>[] | null;
  asset_metadata: {                // Schema mới: JSONB (backup: privacy_mode column)
    privacy_mode?: 'public' | 'city' | 'private';
    auto_hide_night?: boolean;
  } | null;
  identity_status: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Ownership History — Schema mới
 * acquisition_type check constraint: 'first_purchase' | 'transfer' | 'gift' | 'inheritance'
 */
export interface OwnershipHistory {
  id: string;
  passport_id: string;
  owner_id: string;
  owner_handle_snapshot: string | null;
  owner_display_name_snapshot: string | null;
  acquired_at: string;
  released_at: string | null;
  acquisition_type: AcquisitionType;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  post_id: string;
  buyer_id: string;
  seller_id: string;
  gross_amount_vnd: number;
  platform_fee_vnd: number;
  seller_payout_vnd: number;
  fee_rate: number;
  status: PaymentStatus;
  payment_method: string | null;
  held_at: string | null;
  cleared_at: string | null;
  payout_reference: string | null;
  order_code: string | null;
  vietqr_url: string | null;
  payos_ref: string | null;
  raw_webhook_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  starts_at: string;
  ends_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostWithSeller extends Post {
  seller_handle: string;
  seller_name: string | null;
  seller_avatar: string | null;
  seller_reputation: number;
  hub_code: string | null;
  hub_name: string | null;
  hub_city: string | null;
}

export interface NotificationChannel { }
export type NotificationEvent =
  | 'post_submitted'
  | 'post_received_by_hub'
  | 'post_verified'
  | 'post_listed'
  | 'post_sold'
  | 'post_rejected'
  | 'payment_held'
  | 'payment_cleared'
  | 'shoe_scan_lost';

export interface Notification {
  id: string;
  user_id: string;
  channel: string;
  event: NotificationEvent;
  payload: Record<string, unknown>;
  message: string;
  delivered: boolean;
  delivered_at: string | null;
  error: string | null;
  created_at: string;
}

// =====================================================================
// Database type for Supabase client
// =====================================================================
export interface Database {
  public: {
    Tables: {
      users: { Row: User; Insert: Partial<User> & { id: string; handle: string }; Update: Partial<User> };
      hubs: { Row: Hub; Insert: Partial<Hub> & { code: string; name: string; city: string; address: string }; Update: Partial<Hub> };
      posts: { Row: Post; Insert: Omit<Post, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Post> };
      shoe_passports: { Row: ShoePassport; Insert: Omit<ShoePassport, 'id' | 'created_at' | 'updated_at'>; Update: Partial<ShoePassport> };
      ownership_history: { Row: OwnershipHistory; Insert: Omit<OwnershipHistory, 'id'>; Update: Partial<OwnershipHistory> };
      payments: { Row: Payment; Insert: Omit<Payment, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Payment> };
      notifications: { Row: Notification; Insert: Omit<Notification, 'id' | 'created_at'>; Update: Partial<Notification> };
    };
    Views: {
      posts_with_seller: { Row: PostWithSeller };
      users_view: { Row: User };    // Alias user_id → id
    };
  };
}
