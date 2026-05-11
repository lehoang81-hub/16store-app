'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendNotification } from '@/lib/telegram/send';
import { revalidatePath } from 'next/cache';

export interface VerifyInput {
  post_id: string;
  verify_stitching: boolean;
  verify_sole: boolean;
  verify_materials: boolean;
  verify_box: boolean;
  action: 'approve' | 'reject';
  reject_reason?: string;
  security_tier?: 'standard' | 'elite' | 'heritage';
}

export interface VerifyResult {
  success: boolean;
  error?: string;
  new_status?: string;
  passport?: {
    id: string;
    qr_code: string;
    temp_qr_code: string;
    claim_window_expires_at: string;
  };
}

export async function verifyPost(input: VerifyInput): Promise<VerifyResult> {
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  if (!authUser) return { success: false, error: 'Bạn cần đăng nhập' };

  const supabase = createServiceClient();

  const { data: post } = await supabase
    .from('posts')
    .select('id, lot_id, seller_id, hub_id, brand, model, status')
    .eq('id', input.post_id)
    .single();

  if (!post) return { success: false, error: 'Không tìm thấy pair' };

  // Check permission
  const { data: currentUser } = await authClient
    .from('users_view')
    .select('role, hub_id')
    .eq('auth_id', authUser.id)
    .single();

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isHubManager = currentUser?.hub_id === post.hub_id;

  if (!isSuperAdmin && !isHubManager) {
    return { success: false, error: 'Bạn không có quyền verify pair này' };
  }

  if (post.status !== 'draft') {
    return { success: false, error: `Pair đang ở status ${post.status}` };
  }

  const { data: hub } = await supabase
    .from('hubs')
    .select('name')
    .eq('id', post.hub_id)
    .single();

  const now = new Date().toISOString();

  if (input.action === 'approve') {
    if (!input.verify_stitching || !input.verify_sole || !input.verify_materials || !input.verify_box) {
      return { success: false, error: 'Cần verify đủ 4 bước' };
    }

    // Update post → live
    await supabase
      .from('posts')
      .update({
        verify_stitching: true,
        verify_sole: true,
        verify_materials: true,
        verify_box: true,
        verified_at: now,
        verified_by: authUser.id,
        listed_at: now,
        status: 'live',
        updated_at: now,
      } as never)
      .eq('id', input.post_id);

    // Ensure universal_asset exists
    const { data: existingAsset } = await supabase
      .from('universal_assets')
      .select('id, qr_code, claim_window_expires_at')
      .eq('post_id', input.post_id)
      .maybeSingle();

    let assetId: string;
    let qrCode: string;
    let tempQrCode: string;
    let claimWindowExpiresAt: string;

    if (existingAsset) {
      assetId = existingAsset.id;
      qrCode = existingAsset.qr_code;
      tempQrCode = `${qrCode}-TEMP`;
      claimWindowExpiresAt = existingAsset.claim_window_expires_at ?? '';
    } else {
      // Create universal_asset nếu chưa có
      assetId = crypto.randomUUID();
      qrCode = `16S-${post.lot_id}-${assetId.substring(0, 8).toUpperCase()}`;
      tempQrCode = `${qrCode}-TEMP`;
      claimWindowExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      await supabase.from('universal_assets').insert({
        id: assetId,
        post_id: input.post_id,
        owner_id: post.seller_id,
        qr_code: qrCode,
        brand: post.brand,
        model: post.model,
        is_lost: false,
        object_type: 'sneaker',
        attributes: { brand: post.brand, model: post.model },
        security_tier: input.security_tier ?? 'standard',
        identity_status: 'unverified',
        claim_window_expires_at: claimWindowExpiresAt,
        asset_metadata: { privacy_mode: 'public', auto_hide_night: false },
      });

      // identity_qr_tokens
      await supabase.from('identity_qr_tokens').insert({
        passport_id: assetId,
        temp_qr_code: tempQrCode,
        status: 'pending',
      });

      // ownership_history
      await supabase.from('ownership_history').insert({
        passport_id: assetId,
        owner_id: post.seller_id,
        owner_handle_snapshot: 'unknown',
        owner_display_name_snapshot: 'unknown',
        acquired_at: now,
        acquisition_type: 'first_purchase',
        notes: 'Created at hub verify',
        created_at: now,
        updated_at: now,
      });
    }

    // Telegram notify seller
    await sendNotification({
      user_id: post.seller_id,
      event: 'post_listed',
      payload: { lot_id: post.lot_id, hub: hub?.name },
      message:
        `🎉 <b>Pair của bạn đã LIVE!</b>\n\n` +
        `Mã lot: <code>${post.lot_id}</code>\n` +
        `${post.brand} ${post.model}\n` +
        `Hub: ${hub?.name ?? ''}\n\n` +
        `🔑 Mã định danh tạm: <code>${tempQrCode}</code>\n` +
        `⏰ Cửa sổ "The First": 48h kể từ bây giờ\n` +
        `→ Scan QR ngay để nhận danh hiệu "The First"!`,
    });

    revalidatePath('/admin/hub');
    revalidatePath('/');
    revalidatePath(`/lot/${post.lot_id}`);

    return {
      success: true,
      new_status: 'live',
      passport: {
        id: assetId,
        qr_code: qrCode,
        temp_qr_code: tempQrCode,
        claim_window_expires_at: claimWindowExpiresAt,
      },
    };

  } else {
    if (!input.reject_reason || input.reject_reason.length < 10) {
      return { success: false, error: 'Cần lý do từ chối (≥ 10 ký tự)' };
    }

    await supabase
      .from('posts')
      .update({ status: 'rejected', updated_at: now } as never)
      .eq('id', input.post_id);

    await sendNotification({
      user_id: post.seller_id,
      event: 'post_rejected',
      payload: { lot_id: post.lot_id, reason: input.reject_reason },
      message:
        `⚠ <b>Pair của bạn bị từ chối</b>\n\n` +
        `Mã lot: <code>${post.lot_id}</code>\n\n` +
        `<b>Lý do:</b>\n${input.reject_reason}`,
    });

    revalidatePath('/admin/hub');
    return { success: true, new_status: 'rejected' };
  }
}

// ── getPendingPosts ───────────────────────────────────────────
export async function getPendingPosts() {
  // TODO Sprint 4: heritage_listings table chưa tạo
  return [];
}

// ── rejectPost ────────────────────────────────────────────────
export async function rejectPost(lotId: string, reason: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('posts')
    .update({ status: 'rejected' } as never)
    .eq('lot_id', lotId);

  if (error) throw new Error(error.message);
  return { success: true };
}