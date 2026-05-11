/**
 * Spatial Identity System — Type Safety
 * CDC-ready cho BigQuery
 * Tuân thủ: timestamps ISO 8601, số tiền là number
 */

// ─────────────────────────────────────────────────────────
// QR TOKEN
// ─────────────────────────────────────────────────────────
export interface IdentityQrToken {
  id: string                        // UUID
  passport_id: string               // UUID
  temp_qr_code: string
  temp_created_at: string           // ISO 8601
  official_qr_code?: string | null
  official_issued_at?: string | null // ISO 8601
  official_issued_by?: string | null // UUID
  status: 'pending' | 'certified'
  created_at: string                // ISO 8601
  updated_at: string                // ISO 8601
  deleted_at?: string | null        // ISO 8601
}

// ─────────────────────────────────────────────────────────
// SPATIAL FINGERPRINT
// ─────────────────────────────────────────────────────────
export interface SpatialFingerprint {
  lat: number                       // làm tròn 5 chữ số thập phân
  lng: number                       // làm tròn 5 chữ số thập phân
  bearing_deg?: number              // 0-360°, làm tròn đến 45°
  altitude_m?: number
  accuracy_m?: number
  passport_id: string               // UUID
  timestamp: string                 // ISO 8601
}

// Hash function type
export type SpatialHash = string    // SHA256 64 chars

// ─────────────────────────────────────────────────────────
// AI VERIFICATION RESULT
// ─────────────────────────────────────────────────────────
export interface AiVerificationResult {
  verified: boolean
  confidence: number                // 0.000 - 1.000
  verdict: string                   // mô tả ngắn
  asset_detected: boolean           // có thấy vật phẩm trong ảnh không
  asset_match: boolean              // vật phẩm có khớp passport không
  location_plausible: boolean       // vị trí có hợp lý không
  flags: string[]                   // ['blurry', 'wrong_item', 'fake_gps'...]
  model: string                     // 'gemini-2.5-flash'
  analyzed_at: string               // ISO 8601
}

// ─────────────────────────────────────────────────────────
// SPATIAL IDENTITY CLAIM
// ─────────────────────────────────────────────────────────
export type ClaimStatus = 'pending' | 'verified' | 'certified' | 'rejected' | 'disputed'
export type QrType = 'temp' | 'official'

export interface SpatialIdentityClaim {
  id: string                        // UUID
  passport_id: string               // UUID
  claimant_id: string               // UUID

  // Spatial
  location_lat: number
  location_lng: number
  location_accuracy_m?: number | null
  bearing_deg?: number | null
  altitude_m?: number | null
  spatial_hash: string              // SHA256

  // QR
  qr_token_id?: string | null       // UUID
  qr_type: QrType

  // AI
  image_url?: string | null
  ai_verified: boolean
  ai_confidence?: number | null     // 0.000 - 1.000
  ai_verdict?: string | null
  ai_model?: string | null

  // The First
  is_first_claim: boolean
  first_claim_window_expires_at?: string | null  // ISO 8601

  // Status
  status: ClaimStatus
  rejection_reason?: string | null

  // Standards
  created_at: string                // ISO 8601
  updated_at: string                // ISO 8601
  deleted_at?: string | null
}

// ─────────────────────────────────────────────────────────
// IDENTITY DIARY ENTRY
// ─────────────────────────────────────────────────────────
export type DiaryEntryType = 'experience' | 'milestone' | 'maintenance' | 'repair' | 'story'

export interface IdentityDiaryEntry {
  id: string                        // UUID
  passport_id: string               // UUID
  author_id: string                 // UUID

  entry_type: DiaryEntryType
  title?: string | null
  content: string

  // Location (optional)
  location_lat?: number | null
  location_lng?: number | null
  city?: string | null
  country?: string | null

  // Media
  image_urls?: string[]             // array of URLs

  // AI
  ai_tagline?: string | null        // Gemini tóm tắt 1 câu
  ai_tags?: string[]                // tags tự động

  is_public: boolean

  // Standards
  created_at: string                // ISO 8601
  updated_at: string                // ISO 8601
  deleted_at?: string | null
}

// ─────────────────────────────────────────────────────────
// API REQUEST/RESPONSE TYPES
// ─────────────────────────────────────────────────────────

// POST /api/identity/claim
export interface ClaimIdentityRequest {
  passport_id: string               // UUID
  qr_code: string                   // temp hoặc official QR
  location_lat: number
  location_lng: number
  location_accuracy_m?: number
  bearing_deg?: number
  altitude_m?: number
  image_base64?: string             // ảnh để AI verify
  image_mime?: string               // 'image/jpeg' | 'image/png'
}

export interface ClaimIdentityResponse {
  success: boolean
  claim_id?: string                 // UUID
  spatial_hash?: string
  is_first_claim?: boolean
  status?: ClaimStatus
  ai_result?: AiVerificationResult
  first_claim_window_expires_at?: string  // ISO 8601
  error?: string
}

// POST /api/identity/diary
export interface AddDiaryEntryRequest {
  passport_id: string               // UUID
  entry_type: DiaryEntryType
  title?: string
  content: string
  location_lat?: number
  location_lng?: number
  city?: string
  country?: string
  image_urls?: string[]
  is_public?: boolean
}

export interface AddDiaryEntryResponse {
  success: boolean
  entry_id?: string                 // UUID
  ai_tagline?: string
  ai_tags?: string[]
  error?: string
}

// GET /api/identity/[passportId]
export interface PassportIdentityResponse {
  passport_id: string
  identity_status: 'unverified' | 'temp_claimed' | 'certified'
  first_claim?: {
    claimant_handle: string
    claimed_at: string              // ISO 8601
    is_certified: boolean
    location?: {
      city?: string
      country?: string
    }
  } | null
  claim_window_expires_at?: string | null  // ISO 8601
  claim_window_open: boolean
  diary_entries: IdentityDiaryEntry[]
  total_claims: number
}

// ─────────────────────────────────────────────────────────
// SPATIAL HASH GENERATOR (pure function — dùng ở cả client + server)
// ─────────────────────────────────────────────────────────
export function buildSpatialFingerprint(
  lat: number,
  lng: number,
  passportId: string,
  bearing?: number
): SpatialFingerprint {
  return {
    lat: Math.round(lat * 100000) / 100000,      // ~1.1m precision
    lng: Math.round(lng * 100000) / 100000,
    bearing_deg: bearing !== undefined
      ? Math.round(bearing / 45) * 45            // 8 hướng
      : undefined,
    passport_id: passportId,
    timestamp: new Date().toISOString(),
  }
}

// Input để tạo spatial hash
export function buildSpatialHashInput(fp: SpatialFingerprint): string {
  return [
    fp.lat.toFixed(5),
    fp.lng.toFixed(5),
    fp.bearing_deg ?? 'any',
    fp.passport_id,
  ].join('_')
}

// ─────────────────────────────────────────────────────────
// VALIDATORS
// ─────────────────────────────────────────────────────────
export function validateClaimRequest(req: Partial<ClaimIdentityRequest>): string | null {
  if (!req.passport_id) return 'Thiếu passport_id'
  if (!req.qr_code) return 'Thiếu qr_code'
  if (req.location_lat === undefined) return 'Thiếu location_lat'
  if (req.location_lng === undefined) return 'Thiếu location_lng'
  if (typeof req.location_lat !== 'number') return 'location_lat phải là number'
  if (typeof req.location_lng !== 'number') return 'location_lng phải là number'
  if (req.location_lat < -90 || req.location_lat > 90) return 'location_lat không hợp lệ'
  if (req.location_lng < -180 || req.location_lng > 180) return 'location_lng không hợp lệ'
  return null
}

export function validateDiaryEntry(req: Partial<AddDiaryEntryRequest>): string | null {
  if (!req.passport_id) return 'Thiếu passport_id'
  if (!req.content || req.content.trim().length < 10) return 'Nội dung quá ngắn (tối thiểu 10 ký tự)'
  if (!req.entry_type) return 'Thiếu entry_type'
  const validTypes: DiaryEntryType[] = ['experience', 'milestone', 'maintenance', 'repair', 'story']
  if (!validTypes.includes(req.entry_type as DiaryEntryType)) return 'entry_type không hợp lệ'
  return null
}