'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sendNotification } from '@/lib/telegram/send';
import type { PostCondition } from '@/types/database';

export interface SubmitPairInput {
  brand: string;
  model: string;
  colorway: string;
  size_us: number;
  condition: PostCondition;
  release_year: number | null;
  asking_price_vnd: number;
  hub_id: string;
  image_paths: string[];
  security_tier?: 'standard' | 'elite' | 'heritage';
}

export interface SubmitPairResult {
  success: boolean;
  lot_id?: string;
  passport_id?: string;
  temp_qr_code?: string;
  claim_window_expires_at?: string;
  error?: string;
}

export async function submitPair(input: SubmitPairInput): Promise<SubmitPairResult> {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return { success: false, error: 'Bạn cần đăng nhập' };

  // ── Lấy user_id thực (auth_id → user_id) ─────────────────────
  const { data: userProfile } = await supabase
    .from('users_view')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();

  if (!userProfile) return { success: false, error: 'Không tìm thấy hồ sơ người dùng' };
  const userId = userProfile.id;

  // ── Validation ────────────────────────────────────────────────
  if (!input.brand || input.brand.length < 2) {
    return { success: false, error: 'Tên thương hiệu không hợp lệ' };
  }
  if (!input.model || input.model.length < 2) {
    return { success: false, error: 'Tên model không hợp lệ' };
  }
  if (!input.size_us || input.size_us <= 0) {
    return { success: false, error: 'Size không hợp lệ' };
  }
  if (!input.asking_price_vnd || input.asking_price_vnd < 100000) {
    return { success: false, error: 'Giá tối thiểu 100,000 VNĐ' };
  }
  if (!input.hub_id) {
    return { success: false, error: 'Vui lòng chọn hub' };
  }

  const service = createServiceClient();

  // ── Generate lot_id via RPC ───────────────────────────────────
  const { data: lotId, error: lotError } = await service
    .rpc('generate_lot_id', {
      p_brand: input.brand,
      p_release_year: input.release_year,
    });

  if (lotError || !lotId) {
    console.error('[submitPair] lot_id error:', lotError);
    return { success: false, error: 'Không tạo được mã lot: ' + (lotError?.message ?? 'unknown') };
  }

  // ── Image URLs ────────────────────────────────────────────────
  const image_urls = input.image_paths.map((path) => {
    const { data } = service.storage.from('sneaker-photos').getPublicUrl(path);
    return data.publicUrl;
  });

  // ── 1. Insert post ────────────────────────────────────────────
  const { data: post, error: postError } = await service
    .from('posts')
    .insert({
      lot_id: lotId,
      seller_id: userId,
      hub_id: input.hub_id,
      brand: input.brand,
      model: input.model,
      colorway: input.colorway || null,
      size_us: input.size_us,
      condition: input.condition,
      release_year: input.release_year,
      asking_price_vnd: input.asking_price_vnd,
      reserve_price_vnd: Math.round(input.asking_price_vnd * 0.95),
      market_avg_vnd: input.asking_price_vnd,
      status: 'draft',
      image_urls: image_urls.length > 0 ? image_urls : [],
      cover_image_url: image_urls[0] ?? null,
      verify_stitching: false,
      verify_sole: false,
      verify_materials: false,
      verify_box: false,
      view_count: 0,
      is_featured: false,
    } as never)
    .select()
    .single();

  if (postError || !post) {
    console.error('[submitPair] post error:', postError);
    return { success: false, error: 'Không lưu được pair: ' + (postError?.message ?? 'unknown') };
  }

  // ── 2. Create universal_asset ─────────────────────────────────
  const passportId = crypto.randomUUID();
  const qrCode = `16S-${lotId}-${passportId.substring(0, 8).toUpperCase()}`;
  const tempQrCode = `${qrCode}-TEMP`;
  const securityTier = input.security_tier ?? 'standard';
  const now = new Date();
  const claimWindowExpiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const { error: assetError } = await service.from('universal_assets').insert({
    id: passportId,
    post_id: post.id,
    owner_id: userId,
    qr_code: qrCode,
    brand: input.brand,
    model: input.model,
    colorway: input.colorway || null,
    size_us: input.size_us,
    condition: input.condition,
    year: input.release_year,
    is_lost: false,
    object_type: 'sneaker',
    attributes: {
      brand: input.brand,
      model: input.model,
      colorway: input.colorway,
      size_us: input.size_us,
      condition: input.condition,
      year: input.release_year,
      asking_price_vnd: input.asking_price_vnd,
    },
    security_tier: securityTier,
    identity_status: 'unverified',
    claim_window_expires_at: claimWindowExpiresAt,
    first_claimant_id: null,
    first_claimed_at: null,
    asset_metadata: {
      privacy_mode: 'public',
      auto_hide_night: false,
    },
  });

  if (assetError) {
    console.error('[submitPair] asset error:', assetError);
    await service.from('posts').delete().eq('id', post.id);
    return { success: false, error: 'Không tạo được passport: ' + assetError.message };
  }

  // ── 3. Create identity_qr_tokens ──────────────────────────────
  const { error: tokenError } = await service.from('identity_qr_tokens').insert({
    passport_id: passportId,
    temp_qr_code: tempQrCode,
    status: 'pending',
  });

  if (tokenError) {
    console.warn('[submitPair] token error (non-fatal):', tokenError);
  }

  // ── 4. Ownership history ──────────────────────────────────────
  const nowIso = now.toISOString();
  await service.from('ownership_history').insert({
    passport_id: passportId,
    owner_id: userId,
    owner_handle_snapshot: 'unknown',
    owner_display_name_snapshot: 'unknown',
    acquired_at: nowIso,
    acquisition_type: 'first_purchase',
    notes: 'Initial submission by seller',
    created_at: nowIso,
    updated_at: nowIso,
  });

  // ── 5. Telegram notify ───────────────────────────────────────
  const claimExpiryFormatted = new Date(claimWindowExpiresAt).toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  await sendNotification({
    user_id: userId,
    event: 'post_submitted',
    payload: { lot_id: lotId, brand: input.brand, model: input.model },
    message:
      `✅ <b>Pair đã được tiếp nhận!</b>\n\n` +
      `📦 Lot: <code>${lotId}</code>\n` +
      `👟 ${input.brand} ${input.model}\n` +
      `Size: ${input.size_us} US · ${input.condition}\n\n` +
      `🔑 Mã QR tạm: <code>${tempQrCode}</code>\n\n` +
      `⭐ <b>CỬA SỔ "THE FIRST" ĐÃ MỞ!</b>\n` +
      `Bạn có 48h để định danh vật phẩm này đầu tiên.\n` +
      `Hết hạn: ${claimExpiryFormatted}\n\n` +
      `Sau khi hub verify, scan QR ngay để nhận "THE FIRST"!\n` +
      `Tiếp theo: mang giày đến hub để verify.`,
  });

  console.log(
    `[submitPair] SUCCESS: post=${post.id}, passport=${passportId}, lot=${lotId}`
  );

  revalidatePath('/');
  revalidatePath('/dashboard');
  redirect(`/dashboard?submitted=${lotId}`);
}
