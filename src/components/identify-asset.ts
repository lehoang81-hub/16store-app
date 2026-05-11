'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { AngleUrls } from '@/components/identify/ScreenGhostFrame';

// ── Types ─────────────────────────────────────────────────────

export interface IdentifyAssetInput {
  // Item info
  brand: string;
  model: string;
  colorway?: string;
  objectType: string;
  tier: 'standard' | 'elite' | 'heritage';

  // Images (đã upload từ ScreenGhostFrame)
  uploadedUrls: AngleUrls;   // { front, back, top, bottom, left, right, hero }

  // GPS
  lat?: number | null;
  lng?: number | null;
  altitude?: number | null;
  bearing?: number | null;
  accuracy?: number | null;

  // AI results
  aiConfidence?: number;      // 0-100
  uniquenessScore?: number;   // 0-100
  vectorEmbedding?: number[]; // 512-dim CLIP vector
}

export interface IdentifyAssetResult {
  success: boolean;
  qrCode?: string;
  passportId?: string;
  isFirstClaimant?: boolean;
  hlrRewarded?: number;
  error?: string;
}

// ── Main action ───────────────────────────────────────────────

export async function identifyAsset(
  input: IdentifyAssetInput
): Promise<IdentifyAssetResult> {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) return { success: false, error: 'Chưa đăng nhập' };

    // Get real user_id từ users_view
    const { data: userProfile } = await authClient
      .from('users_view')
      .select('id, handle, reward_points')
      .eq('auth_id', authUser.id)
      .single();

    if (!userProfile) return { success: false, error: 'Không tìm thấy hồ sơ người dùng' };

    const supabase = createServiceClient();

    // ── Duplicate check ──────────────────────────────────────
    // Cùng owner + brand + model trong 24h
    const since24h = new Date(Date.now() - 86400000).toISOString();
    const { data: existing } = await supabase
      .from('universal_assets')
      .select('id, qr_code, identity_status')
      .eq('owner_id', userProfile.id)
      .eq('brand', input.brand)
      .eq('model', input.model)
      .gte('created_at', since24h)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: `"${input.brand} ${input.model}" đã được định danh trong 24h qua.\nMã QR: ${existing.qr_code}`,
      };
    }

    // ── Build image data ─────────────────────────────────────
    const { uploadedUrls } = input;

    // Tất cả URL không null
    const allImageUrls = Object.values(uploadedUrls).filter(Boolean) as string[];

    // Cover = hero (ảnh tự chọn), fallback về front
    const coverImageUrl = uploadedUrls.hero ?? (uploadedUrls as any).front ?? allImageUrls[0] ?? null;

    // Angles JSONB: { front: url, back: url, ... }
    const imageAngles: Record<string, string> = {};
    for (const [angle, url] of Object.entries(uploadedUrls)) {
      if (url) imageAngles[angle] = url;
    }

    // ── Generate QR code ─────────────────────────────────────
    const shortId   = crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
    const typeCode  = input.objectType.substring(0, 1).toUpperCase();
    const tierCode  = input.tier === 'standard' ? 'S' : input.tier === 'elite' ? 'E' : 'H';
    const now       = new Date();
    const yearCode  = String(now.getFullYear()).substring(2);
    const seqNum    = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    const qrCode    = `16S-ID-${typeCode}-${seqNum}-${shortId}`;

    // ── Spatial hash ─────────────────────────────────────────
    let spatialHash: string | null = null;
    if (input.lat && input.lng) {
      spatialHash = `${input.lat.toFixed(4)}:${input.lng.toFixed(4)}:${Math.floor(Date.now() / 1000)}`;
    }

    // ── Mint passport (universal_assets) ─────────────────────
    const { data: passport, error: mintError } = await supabase
      .from('universal_assets')
      .insert({
        qr_code:          qrCode,
        owner_id:         userProfile.id,
        post_id:          null,
        object_type:      input.objectType,
        brand:            input.brand,
        model:            input.model,
        colorway:         input.colorway ?? null,
        security_tier:    input.tier,
        identity_status:  'temp_claimed',
        attributes: {
          brand:    input.brand,
          model:    input.model,
          colorway: input.colorway,
        },
        // ── Image chain (immutable sau khi mint) ──
        image_urls:        allImageUrls,
        cover_image_url:   coverImageUrl,
        image_angles:      imageAngles,
        image_ai_verified: (input.aiConfidence ?? 0) >= 80,
        image_captured_at: now.toISOString(),
        // ── AI data ──
        vector_embedding:  input.vectorEmbedding ?? null,
        journey_score:     50,
        journey_log: [{
          reason:      'born',
          points:      50,
          timestamp:   now.toISOString(),
          score_after: 50,
          metadata: {
            brand:       input.brand,
            model:       input.model,
            object_type: input.objectType,
            ai_confidence:   input.aiConfidence,
            uniqueness_score: input.uniquenessScore,
            has_images:  allImageUrls.length,
            angles:      Object.keys(imageAngles),
          },
        }],
        // ── Claim window ──
        first_claimant_id:      null,  // Set sau khi user scan QR
        first_claimed_at:       null,
        claim_window_expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        transfer_status:  'locked',
        is_lost:          false,
      } as never)
      .select()
      .single();

    if (mintError || !passport) {
      console.error('[identifyAsset] Mint error:', mintError);
      return { success: false, error: mintError?.message ?? 'Không thể tạo hộ chiếu' };
    }

    // ── Auto journal: Khai sinh ──────────────────────────────
    await supabase.from('passport_journal').insert({
      passport_id:       passport.id,
      owner_id:          userProfile.id,
      entry_type:        'other',
      title:             '✦ Khai sinh — THE FIRST',
      content:           `Vật phẩm được định danh lần đầu tiên lúc ${now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.
Định danh bởi @${userProfile.handle ?? 'unknown'} · THE FIRST CLAIMANT.`,
      entry_date:        now.toISOString().split('T')[0],
      image_urls:        [],
      is_system:         true,
      system_event_type: 'born',
      is_public:         true,
    } as never);

    // ── QR Token ─────────────────────────────────────────────
    const tempQr = `TEMP-${crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
    await supabase.from('identity_qr_tokens').insert({
      passport_id:  passport.id,
      temp_qr_code: tempQr,
      expires_at:   new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      is_used:      false,
    } as never);

    // ── Ownership history ─────────────────────────────────────
    await supabase.from('ownership_history').insert({
      passport_id:      passport.id,
      owner_id:         userProfile.id,
      acquisition_type: 'first_purchase',
      acquired_at:      now.toISOString(),
      location_lat:     input.lat ?? null,
      location_lng:     input.lng ?? null,
      owner_handle_snapshot:       userProfile.handle ?? 'unknown',
      owner_display_name_snapshot: userProfile.handle ?? 'Unknown',
    } as never);

    // ── Spatial identity claim ────────────────────────────────
    if (spatialHash) {
      await supabase.from('spatial_identity_claims').insert({
        passport_id:  passport.id,
        user_id:      userProfile.id,
        spatial_hash: spatialHash,
        lat:          input.lat,
        lng:          input.lng,
        accuracy_m:   input.accuracy ?? null,
        is_first_claim: true,
      } as never);
    }

    // ── THE FIRST: +50 HLR ───────────────────────────────────
    const HLR_REWARD = 50;
    await supabase
      .from('users')
      .update({ reward_points: (userProfile.reward_points ?? 0) + HLR_REWARD })
      .eq('user_id', userProfile.id);

    return {
      success:         true,
      qrCode:          passport.qr_code,
      passportId:      passport.id,
      isFirstClaimant: true,
      hlrRewarded:     HLR_REWARD,
    };

  } catch (err) {
    console.error('[identifyAsset]', err);
    return { success: false, error: String(err) };
  }
}

// ── Helper: Get asset with images (cho HeritageListing) ──────

export async function getAssetWithImages(assetId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('universal_assets')
    .select(`
      id, qr_code, brand, model, colorway,
      object_type, security_tier, identity_status,
      image_urls, cover_image_url, image_angles,
      image_ai_verified, image_captured_at,
      first_claimant_id, created_at,
      owner_id
    `)
    .eq('id', assetId)
    .single();
  return data;
}
