/**
 * 16Store Post Types
 * Match HLRace/16Store merged DB schema
 * enum post_status: draft | pending_payment | pending_verify | live | reserved | sold | rejected | withdrawn
 * enum post_condition: DS | VNDS | 9_5 | 9 | 8_5 | 8
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type PostStatus =
  | 'draft'
  | 'pending_payment'
  | 'pending_verify'
  | 'live'
  | 'reserved'
  | 'sold'
  | 'rejected'
  | 'withdrawn';

export type PostCondition = 'DS' | 'VNDS' | '9_5' | '9' | '8_5' | '8';

// ─── Display Labels ───────────────────────────────────────────────────────────

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  draft:           'Nháp',
  pending_payment: 'Chờ thanh toán',
  pending_verify:  'Chờ xác minh',
  live:            'Đang bán',
  reserved:        'Đã đặt cọc',
  sold:            'Đã bán',
  rejected:        'Bị từ chối',
  withdrawn:       'Đã rút',
};

export const POST_STATUS_COLOR: Record<PostStatus, string> = {
  draft:           'text-concrete',
  pending_payment: 'text-hazard',
  pending_verify:  'text-hazard',
  live:            'text-green-400',
  reserved:        'text-rust',
  sold:            'text-bone-2',
  rejected:        'text-red-400',
  withdrawn:       'text-concrete',
};

export const POST_CONDITION_LABEL: Record<PostCondition, string> = {
  DS:   'Deadstock',
  VNDS: 'Very Near DS',
  '9_5': 'Worn 1-2 lần',
  '9':   'Used Very Good',
  '8_5': 'Good Wear',
  '8':   'Heavy Wear',
};

export const POST_CONDITION_SHORT: Record<PostCondition, string> = {
  DS:   'DS',
  VNDS: 'VNDS',
  '9_5': '9.5/10',
  '9':   '9/10',
  '8_5': '8.5/10',
  '8':   '8/10',
};

// ─── Fallback helpers (Ưu tiên #3) ───────────────────────────────────────────

export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return POST_STATUS_LABEL[status as PostStatus] ?? status;
}

export function getStatusColor(status: string | null | undefined): string {
  if (!status) return 'text-concrete';
  return POST_STATUS_COLOR[status as PostStatus] ?? 'text-concrete';
}

export function getConditionLabel(condition: string | null | undefined): string {
  if (!condition) return '—';
  return POST_CONDITION_LABEL[condition as PostCondition] ?? condition;
}

export function getConditionShort(condition: string | null | undefined): string {
  if (!condition) return '—';
  return POST_CONDITION_SHORT[condition as PostCondition] ?? condition;
}

// ─── Post type ────────────────────────────────────────────────────────────────

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
  cover_image_url: string | null;
  image_urls: string[] | null;
  verify_stitching: boolean | null;
  verify_sole: boolean | null;
  verify_materials: boolean | null;
  verify_box: boolean | null;
  verified_at: string | null;
  verified_by: string | null;
  ai_extracted: Record<string, unknown> | null;
  view_count: number;
  is_featured: boolean;
  listed_at: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
