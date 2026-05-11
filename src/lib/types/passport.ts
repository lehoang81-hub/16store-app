/**
 * 16Store Passport Types
 * Match HLRace/16Store merged shoe_passports schema
 * Privacy mode lưu trong asset_metadata JSONB (không phải column riêng)
 */

import type { PostCondition } from './post';

// ─── Privacy ──────────────────────────────────────────────────────────────────

export type PrivacyMode =
  | 'public_precise'
  | 'public_city'
  | 'friends'
  | 'private';

export const PRIVACY_LABEL: Record<PrivacyMode, string> = {
  public_precise: 'PUBLIC · PRECISE',
  public_city:    'PUBLIC · CITY-LEVEL',
  friends:        'FRIENDS ONLY',
  private:        'PRIVATE',
};

// ─── AssetMetadata JSONB ──────────────────────────────────────────────────────

export interface AssetMetadata {
  privacy_mode?: PrivacyMode;
  auto_hide_night?: boolean;   // Ẩn location 22:00-06:00
  partner_api_enabled?: boolean;
  custom_fields?: Record<string, unknown>;
}

// ─── Passport ─────────────────────────────────────────────────────────────────

export interface Passport {
  id: string;
  qr_code: string;
  post_id: string;
  owner_id: string;
  brand: string;
  model: string;
  colorway: string | null;
  size_us: number;
  condition: PostCondition;
  year: number | null;
  serial_number: string | null;
  is_lost: boolean;
  lost_at: string | null;
  found_at: string | null;
  image_urls: string[] | null;
  journey_score: number;
  journey_log: Record<string, unknown> | null;
  asset_type: string | null;
  asset_metadata: AssetMetadata | null;
  identity_status: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ─── Ownership History ────────────────────────────────────────────────────────

export type AcquisitionType =
  | 'first_purchase'
  | 'transfer'
  | 'gift'
  | 'inheritance';

export const ACQUISITION_LABEL: Record<AcquisitionType, string> = {
  first_purchase: 'Mua mới',
  transfer:       'Sang tay',
  gift:           'Được tặng',
  inheritance:    'Thừa kế',
};

export interface OwnershipRecord {
  id: string;
  passport_id: string;
  owner_id: string;
  owner_handle_snapshot: string | null;
  owner_display_name_snapshot: string | null;
  acquired_at: string;
  released_at: string | null;   // null = đang sở hữu
  acquisition_type: AcquisitionType;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Scan Event ───────────────────────────────────────────────────────────────

export type ScanType =
  | 'hub_intake'
  | 'owner_check'
  | 'public_view'
  | 'lost_found_finder';

export const SCAN_COLOR: Record<ScanType, string> = {
  hub_intake:         '#c8531c',  // rust
  owner_check:        '#6ec070',  // green
  public_view:        '#4a9eff',  // blue
  lost_found_finder:  '#d4a84a',  // gold
};

export interface ScanEvent {
  id: string;
  passport_id: string;
  scanned_by_user_id: string | null;
  scan_type: ScanType;
  location_lat: number | null;
  location_lng: number | null;
  location_accuracy_m: number | null;
  city: string | null;
  district: string | null;
  country: string | null;
  is_meaningful: boolean;
  created_at: string;
}

// ─── Fallback helpers (Ưu tiên #3) ───────────────────────────────────────────

export function getPrivacyMode(passport: Passport | null | undefined): PrivacyMode {
  return passport?.asset_metadata?.privacy_mode ?? 'public_city';
}

export function getPrivacyLabel(passport: Passport | null | undefined): string {
  const mode = getPrivacyMode(passport);
  return PRIVACY_LABEL[mode];
}

export function getScanColor(scanType: string | null | undefined): string {
  if (!scanType) return '#4a9eff';
  return SCAN_COLOR[scanType as ScanType] ?? '#4a9eff';
}

export function getAcquisitionLabel(type: string | null | undefined): string {
  if (!type) return '—';
  return ACQUISITION_LABEL[type as AcquisitionType] ?? type;
}
