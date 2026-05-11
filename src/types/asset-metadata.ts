/**
 * Asset Metadata Types — JSON Type Safety
 * CDC-ready cho BigQuery
 * Tất cả giá tiền là number (VNĐ)
 * Tất cả ngày tháng là ISO 8601 string
 */

// ─────────────────────────────────────────────────────────
// BASE — dùng chung cho mọi asset
// ─────────────────────────────────────────────────────────
export interface BaseAssetMetadata {
  brand?: string
  model?: string
  condition?: string
  year_manufactured?: number        // năm sản xuất
  serial_number?: string            // số serial nếu có
  original_price_vnd?: number       // giá gốc khi mua
  purchase_date?: string            // ISO 8601: "2024-01-15"
  warranty_expires?: string         // ISO 8601
  notes?: string
}

// ─────────────────────────────────────────────────────────
// SNEAKER
// ─────────────────────────────────────────────────────────
export interface SneakerMetadata extends BaseAssetMetadata {
  asset_type: 'sneaker'
  colorway?: string
  size_us?: number
  release_year?: number
  sku?: string                      // VD: "DH7138-006"
}

// ─────────────────────────────────────────────────────────
// WATCH
// ─────────────────────────────────────────────────────────
export interface WatchMetadata extends BaseAssetMetadata {
  asset_type: 'watch'
  case_size_mm?: number
  material?: string                 // VD: "stainless steel", "titanium"
  movement?: 'automatic' | 'quartz' | 'solar' | 'manual'
  water_resistant_m?: number        // số mét chống nước
  has_box?: boolean
  has_papers?: boolean
}

// ─────────────────────────────────────────────────────────
// APPAREL
// ─────────────────────────────────────────────────────────
export interface ApparelMetadata extends BaseAssetMetadata {
  asset_type: 'apparel'
  type?: string                     // VD: "áo", "quần", "jacket"
  size?: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | string
  material?: string                 // VD: "Dri-FIT", "cotton"
  gender?: 'male' | 'female' | 'unisex'
  color?: string
}

// ─────────────────────────────────────────────────────────
// GEAR (balo, lều, đồ leo núi...)
// ─────────────────────────────────────────────────────────
export interface GearMetadata extends BaseAssetMetadata {
  asset_type: 'gear'
  type?: string                     // VD: "balo", "lều", "giày leo núi"
  weight_kg?: number
  capacity_l?: number               // dung tích lít (nếu có)
  waterproof?: boolean
  color?: string
}

// ─────────────────────────────────────────────────────────
// BAG (túi xách, ví...)
// ─────────────────────────────────────────────────────────
export interface BagMetadata extends BaseAssetMetadata {
  asset_type: 'bag'
  type?: string                     // VD: "tote", "clutch", "backpack"
  material?: string                 // VD: "leather", "canvas"
  color?: string
  size?: 'small' | 'medium' | 'large' | string
  has_dustbag?: boolean
  has_box?: boolean
  has_receipt?: boolean
}

// ─────────────────────────────────────────────────────────
// ELECTRONICS
// ─────────────────────────────────────────────────────────
export interface ElectronicsMetadata extends BaseAssetMetadata {
  asset_type: 'electronics'
  type?: string                     // VD: "phone", "laptop", "camera"
  storage_gb?: number
  color?: string
  battery_health_pct?: number       // 0-100
  has_charger?: boolean
  has_box?: boolean
  imei?: string                     // cho điện thoại
}

// ─────────────────────────────────────────────────────────
// PET
// ─────────────────────────────────────────────────────────
export interface PetMetadata extends BaseAssetMetadata {
  asset_type: 'pet'
  species?: string                  // VD: "dog", "cat", "bird"
  breed?: string
  age_months?: number
  gender?: 'male' | 'female'
  color?: string
  vaccinated?: boolean
  neutered?: boolean
  microchip_id?: string
  born_at?: string                  // ISO 8601
}

// ─────────────────────────────────────────────────────────
// MEDICAL (chân tay giả, thiết bị y tế...)
// ─────────────────────────────────────────────────────────
export interface MedicalMetadata extends BaseAssetMetadata {
  asset_type: 'medical'
  type?: string                     // VD: "prosthetic leg", "wheelchair"
  size?: string
  material?: string
  certified?: boolean               // có chứng nhận y tế không
}

// ─────────────────────────────────────────────────────────
// BIB (race bib từ HLRace)
// ─────────────────────────────────────────────────────────
export interface BibMetadata extends BaseAssetMetadata {
  asset_type: 'bib'
  race_name?: string
  race_date?: string                // ISO 8601
  distance_km?: number
  bib_number?: string
  finisher?: boolean
  finish_time_seconds?: number
}

// ─────────────────────────────────────────────────────────
// OTHER
// ─────────────────────────────────────────────────────────
export interface OtherMetadata extends BaseAssetMetadata {
  asset_type: 'other'
  type?: string
  color?: string
  dimensions?: string              // VD: "30x20x10cm"
}

// ─────────────────────────────────────────────────────────
// UNION TYPE — dùng ở mọi nơi
// ─────────────────────────────────────────────────────────
export type AssetMetadata =
  | SneakerMetadata
  | WatchMetadata
  | ApparelMetadata
  | GearMetadata
  | BagMetadata
  | ElectronicsMetadata
  | PetMetadata
  | MedicalMetadata
  | BibMetadata
  | OtherMetadata

// ─────────────────────────────────────────────────────────
// WALLET TRANSACTION metadata
// ─────────────────────────────────────────────────────────
export interface WalletTransactionMetadata {
  order_id?: string                 // UUID
  lot_id?: string
  counterparty_id?: string          // UUID của buyer/seller
  platform_fee_vnd?: number         // phí platform
  affiliate_commission_vnd?: number // hoa hồng affiliate
  transferred_at?: string           // ISO 8601
  notes?: string
}

// ─────────────────────────────────────────────────────────
// ORDER metadata
// ─────────────────────────────────────────────────────────
export interface OrderMetadata {
  vietqr_ref?: string
  payos_order_id?: string
  payment_method?: 'vietqr' | 'payos' | 'cash'
  paid_at?: string                  // ISO 8601
  confirmed_at?: string             // ISO 8601
  notes?: string
}

// ─────────────────────────────────────────────────────────
// JOURNEY LOG entry (shoe_passports.journey_log)
// ─────────────────────────────────────────────────────────
export interface JourneyLogEntry {
  event: 'born' | 'qr_scan' | 'ownership_transfer' | 'race_finish' | 'custom'
  points: number
  score_after: number
  reason?: string
  metadata?: {
    city?: string
    country?: string
    race_name?: string
    new_owner_id?: string           // UUID
  }
  timestamp: string                 // ISO 8601
}

// ─────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────
export function isSneakerMetadata(m: AssetMetadata): m is SneakerMetadata {
  return m.asset_type === 'sneaker'
}
export function isWatchMetadata(m: AssetMetadata): m is WatchMetadata {
  return m.asset_type === 'watch'
}
export function isPetMetadata(m: AssetMetadata): m is PetMetadata {
  return m.asset_type === 'pet'
}
export function isBibMetadata(m: AssetMetadata): m is BibMetadata {
  return m.asset_type === 'bib'
}

// ─────────────────────────────────────────────────────────
// VALIDATOR — đảm bảo số tiền là number, ngày là ISO string
// ─────────────────────────────────────────────────────────
export function validateAssetMetadata(data: Record<string, unknown>): boolean {
  const priceFields = ['original_price_vnd', 'price_vnd']
  const dateFields = ['purchase_date', 'warranty_expires', 'born_at', 'race_date']

  for (const field of priceFields) {
    if (field in data && typeof data[field] !== 'number') {
      console.warn(`[metadata] ${field} phải là number, nhận được:`, typeof data[field])
      return false
    }
  }

  for (const field of dateFields) {
    if (field in data && typeof data[field] !== 'string') {
      console.warn(`[metadata] ${field} phải là ISO string, nhận được:`, typeof data[field])
      return false
    }
    if (field in data && typeof data[field] === 'string') {
      const d = new Date(data[field] as string)
      if (isNaN(d.getTime())) {
        console.warn(`[metadata] ${field} không phải ISO 8601 hợp lệ:`, data[field])
        return false
      }
    }
  }

  return true
}
