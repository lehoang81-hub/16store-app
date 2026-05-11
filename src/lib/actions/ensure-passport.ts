'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export interface EnsurePassportResult {
  success: boolean;
  passport?: {
    id: string;
    qr_code: string;
    temp_qr_code: string;
    identity_status: string;
    security_tier: string;
    claim_window_expires_at: string;
  };
  error?: string;
}

const TIER_CONFIG = {
  standard: {
    model: 'gemini-flash',
    hash_algo: 'phash',
    vps_enabled: false,
    clip_enabled: false,
    capture_guide: {
      required_angles: ['front', 'side', 'sole', 'tag'],
      min_photos: 4,
      anchor_points: ['toe_box', 'heel', 'logo', 'sole_edge'],
    },
  },
  elite: {
    model: 'clip-vit-b32',
    hash_algo: 'phash+clip',
    vps_enabled: false,
    clip_enabled: true,
    capture_guide: {
      required_angles: ['front', 'side', 'sole', 'tag', 'detail'],
      min_photos: 6,
      anchor_points: ['toe_box', 'heel', 'logo', 'sole_edge', 'stitching', 'insole'],
    },
  },
  heritage: {
    model: 'clip+vps',
    hash_algo: 'phash+clip+pointcloud',
    vps_enabled: true,
    clip_enabled: true,
    capture_guide: {
      required_angles: ['front', 'side', 'sole', 'tag', 'detail', 'macro'],
      min_photos: 8,
      anchor_points: ['toe_box', 'heel', 'logo', 'sole_edge', 'stitching', 'insole', 'material', 'serial'],
    },
  },
};

/**
 * Tạo Universal Asset Passport khi post được verify.
 * Tích hợp Identity Engine:
 * - universal_assets (passport chính)
 * - identity_qr_tokens (temp → official QR lifecycle)
 * - 48h "The First" claim window
 */
export async function ensurePassport(input: {
  post_id: string;
  security_tier?: 'standard' | 'elite' | 'heritage';
}): Promise<EnsurePassportResult> {

  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  if (!authUser) return { success: false, error: 'Bạn cần đăng nhập' };

  const { data: currentUser } = await authClient
    .from('users_view')
    .select('role')
    .eq('auth_id', authUser.id)
    .single();

  if (!['hub_admin', 'super_admin'].includes(currentUser?.role ?? '')) {
    return { success: false, error: 'Chỉ admin mới được tạo passport' };
  }

  const supabase = createServiceClient();

  // Check existing
  const { data: existing } = await supabase
    .from('universal_assets')
    .select('id, qr_code, identity_status, security_tier, claim_window_expires_at')
    .eq('post_id', input.post_id)
    .maybeSingle();

  if (existing) {
    const { data: token } = await supabase
      .from('identity_qr_tokens')
      .select('temp_qr_code')
      .eq('passport_id', existing.id)
      .maybeSingle();

    return {
      success: true,
      passport: {
        id: existing.id,
        qr_code: existing.qr_code,
        temp_qr_code: token?.temp_qr_code ?? existing.qr_code,
        identity_status: existing.identity_status ?? 'unverified',
        security_tier: existing.security_tier,
        claim_window_expires_at: existing.claim_window_expires_at ?? '',
      },
    };
  }

  // Get post info
  const { data: post } = await supabase
    .from('posts')
    .select('lot_id, seller_id, brand, model, colorway, size_us, condition, release_year, asking_price_vnd')
    .eq('id', input.post_id)
    .single();

  if (!post) return { success: false, error: 'Không tìm thấy post' };

  const securityTier = input.security_tier ?? 'standard';
  const now = new Date();
  const passportId = crypto.randomUUID();
  const qrCode = `16S-${post.lot_id}-${passportId.substring(0, 8).toUpperCase()}`;
  const tempQrCode = `${qrCode}-TEMP`;
  const claimWindowExpiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  // 1. Create universal_asset
  const { data: passport, error: passportError } = await supabase
    .from('universal_assets')
    .insert({
      id: passportId,
      post_id: input.post_id,
      owner_id: post.seller_id,
      qr_code: qrCode,
      brand: post.brand,
      model: post.model,
      colorway: post.colorway,
      size_us: post.size_us,
      condition: post.condition,
      year: post.release_year,
      is_lost: false,
      object_type: 'sneaker',
      attributes: {
        brand: post.brand,
        model: post.model,
        colorway: post.colorway,
        size_us: post.size_us,
        condition: post.condition,
        year: post.release_year,
        asking_price_vnd: post.asking_price_vnd,
      },
      security_tier: securityTier,
      security_tier_config: TIER_CONFIG[securityTier],
      identity_status: 'unverified',
      claim_window_expires_at: claimWindowExpiresAt,
      asset_metadata: {
        privacy_mode: 'public',
        auto_hide_night: false,
      },
    })
    .select()
    .single();

  if (passportError || !passport) {
    console.error('[ensurePassport] Error:', passportError);
    return { success: false, error: passportError?.message ?? 'Failed' };
  }

  // 2. Create identity_qr_tokens
  await supabase.from('identity_qr_tokens').insert({
    passport_id: passportId,
    temp_qr_code: tempQrCode,
    status: 'pending',
  });

  // 3. Create ownership_history
  const nowIso = now.toISOString();
  await supabase.from('ownership_history').insert({
    passport_id: passportId,
    owner_id: post.seller_id,
    owner_handle_snapshot: 'unknown',
    owner_display_name_snapshot: 'unknown',
    acquired_at: nowIso,
    acquisition_type: 'first_purchase',
    notes: 'Passport created at hub verification',
    created_at: nowIso,
    updated_at: nowIso,
  });

  console.log(`[ensurePassport] Created ${passportId} | Tier: ${securityTier} | Window: 48h`);

  return {
    success: true,
    passport: {
      id: passportId,
      qr_code: qrCode,
      temp_qr_code: tempQrCode,
      identity_status: 'unverified',
      security_tier: securityTier,
      claim_window_expires_at: claimWindowExpiresAt,
    },
  };
}
