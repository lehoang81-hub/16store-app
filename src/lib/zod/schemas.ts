/**
 * 16Store Zod Schemas
 * Validate input trước khi insert/update DB
 * Tuân thủ nguyên tắc: Zod schema tại actions.ts trước mọi thao tác chèn
 */

import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const PostStatusSchema = z.enum([
  'draft',
  'pending_payment',
  'pending_verify',
  'live',
  'reserved',
  'sold',
  'rejected',
  'withdrawn',
]);

export const PostConditionSchema = z.enum(['DS', 'VNDS', '9_5', '9', '8_5', '8']);

export const PrivacyModeSchema = z.enum([
  'public_precise',
  'public_city',
  'friends',
  'private',
]);

export const AcquisitionTypeSchema = z.enum([
  'first_purchase',
  'transfer',
  'gift',
  'inheritance',
]);

export const ScanTypeSchema = z.enum([
  'hub_intake',
  'owner_check',
  'public_view',
  'lost_found_finder',
]);

// ─── AssetMetadata ────────────────────────────────────────────────────────────

export const AssetMetadataSchema = z.object({
  privacy_mode: PrivacyModeSchema.optional().default('public_city'),
  auto_hide_night: z.boolean().optional().default(true),
  partner_api_enabled: z.boolean().optional().default(false),
  custom_fields: z.record(z.unknown()).optional(),
});

// ─── Post ─────────────────────────────────────────────────────────────────────

export const SubmitPostSchema = z.object({
  brand: z.string().min(1, 'Bắt buộc').max(100),
  model: z.string().min(1, 'Bắt buộc').max(200),
  colorway: z.string().max(200).optional(),
  size_us: z.number().min(1).max(20),
  condition: PostConditionSchema,
  release_year: z.number().int().min(1970).max(new Date().getFullYear() + 1).optional(),
  asking_price_vnd: z.number().int().min(100000, 'Tối thiểu 100,000 VND').max(500000000, 'Tối đa 500,000,000 VND'),
  reserve_price_vnd: z.number().int().min(0).optional(),
});

export const UpdatePostStatusSchema = z.object({
  postId: z.string().uuid(),
  status: PostStatusSchema,
  note: z.string().max(500).optional(),
});

// ─── Passport ─────────────────────────────────────────────────────────────────

export const EnsurePassportSchema = z.object({
  postId: z.string().uuid(),
  ownerId: z.string().uuid(),
  privacyMode: PrivacyModeSchema.default('public_city'),
  autoHideNight: z.boolean().default(true),
});

export const RecordScanSchema = z.object({
  qrCode: z.string().min(1),
  scanType: ScanTypeSchema,
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracyM: z.number().min(0).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(10).optional(),
});

// ─── Ownership History ────────────────────────────────────────────────────────

export const InsertOwnershipSchema = z.object({
  passportId: z.string().uuid(),
  ownerId: z.string().uuid(),
  ownerHandleSnapshot: z.string().max(100).nullable().optional(),
  ownerDisplayNameSnapshot: z.string().max(200).nullable().optional(),
  acquiredAt: z.string().datetime(),
  releasedAt: z.string().datetime().nullable().optional(),
  acquisitionType: AcquisitionTypeSchema,
  notes: z.string().max(500).nullable().optional(),
});

// ─── System Config (16Store domain) ──────────────────────────────────────────

export const UpdateSettingSchema = z.object({
  key: z.string().startsWith('16store.').min(10),
  value: z.string().min(1).max(1000),
});

// ─── Handle generation ────────────────────────────────────────────────────────

/**
 * Auto-generate handle từ email (Mismatch #6)
 * Fallback display nếu null (Ưu tiên #3)
 * vd: lehoang81@gmail.com → lehoang81
 */
export function generateHandleFromEmail(email: string): string {
  const prefix = email.split('@')[0] ?? '';
  return prefix
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 30);
}

/**
 * Display fallback cho handle null (Ưu tiên #3)
 * Không hiện text kỹ thuật thô
 */
export function displayHandle(
  handle: string | null | undefined,
  email: string | null | undefined
): string {
  if (handle) return `@${handle}`;
  if (email) return `@${email.split('@')[0]}`;
  return '@anonymous';
}
