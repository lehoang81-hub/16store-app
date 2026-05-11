'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendNotification } from '@/lib/telegram/send';
import { revalidatePath } from 'next/cache';

// ── Types ─────────────────────────────────────────────────────

export interface ReportLostResult {
  success: boolean;
  recovery_id?: string;
  toast: {
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  };
}

export interface ReportFoundResult {
  success: boolean;
  reward?: {
    hlr_amount: number;
    message: string;
  };
  toast: {
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  };
}

export interface ConfirmRecoveryResult {
  success: boolean;
  toast: {
    type: 'success' | 'error';
    title: string;
    message: string;
  };
}

export interface CancelLostResult {
  success: boolean;
  toast: {
    type: 'success' | 'error';
    title: string;
    message: string;
  };
}

// ── Step 1: Owner báo mất ────────────────────────────────────

/**
 * Chủ sở hữu báo mất vật phẩm.
 * → is_lost = true
 * → Block mọi transfer
 * → Tạo lost_recovery_log
 * → Notify nearby hubs (future: geo-alert)
 */
export async function reportLost(input: {
  assetId: string;
  lastSeenLat?: number;
  lastSeenLng?: number;
  note?: string;
  rewardHlr?: number;   // Chủ có thể tăng reward để attract finder
}): Promise<ReportLostResult> {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();

    if (!authUser) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Chưa đăng nhập',
          message: 'Bạn cần đăng nhập để báo mất vật phẩm.',
        },
      };
    }

    const { data: userProfile } = await authClient
      .from('users_view')
      .select('id, handle, display_name')
      .eq('auth_id', authUser.id)
      .single();

    if (!userProfile) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Lỗi hồ sơ',
          message: 'Không tìm thấy hồ sơ người dùng.',
        },
      };
    }

    const supabase = createServiceClient();

    // Gọi DB function report_lost()
    const { data, error } = await supabase
      .rpc('report_lost', {
        p_asset_id:      input.assetId,
        p_owner_id:      userProfile.id,
        p_last_seen_lat: input.lastSeenLat ?? null,
        p_last_seen_lng: input.lastSeenLng ?? null,
        p_note:          input.note ?? null,
      })
      .single();

    if (error) {
      console.error('[reportLost] RPC error:', error);
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Lỗi hệ thống',
          message: 'Không thể báo mất. Vui lòng thử lại.',
        },
      };
    }

    if (!data.success) {
      const isAlreadyLost = data.error?.includes('đã được báo mất');
      return {
        success: false,
        toast: {
          type: isAlreadyLost ? 'warning' : 'error',
          title: isAlreadyLost ? '⚠️ Đã báo mất rồi' : 'Không thể báo mất',
          message: data.error ?? 'Thao tác thất bại.',
        },
      };
    }

    // Update reward nếu chủ muốn tăng
    if (input.rewardHlr && input.rewardHlr > 50) {
      await supabase
        .from('lost_recovery_log')
        .update({ reward_hlr: input.rewardHlr })
        .eq('id', data.recovery_id);
    }

    // Lấy asset info để notify
    const { data: asset } = await supabase
      .from('universal_assets')
      .select('qr_code, object_type, attributes')
      .eq('id', input.assetId)
      .single();

    const attrs = (asset?.attributes as any) ?? {};
    const rewardAmount = input.rewardHlr ?? 50;

    // Notify owner confirm
    await sendNotification({
      user_id: userProfile.id,
      event: 'shoe_scan_lost' as any,
      payload: { asset_id: input.assetId, recovery_id: data.recovery_id },
      message:
        `🚨 <b>Vật phẩm đã được báo mất!</b>\n\n` +
        `${attrs.brand ?? ''} ${attrs.model ?? ''}\n` +
        `QR: <code>${asset?.qr_code ?? '-'}</code>\n\n` +
        `✅ Mọi giao dịch chuyển nhượng đã bị khóa.\n` +
        `🏆 Phần thưởng cho người tìm: ${rewardAmount} HLR\n\n` +
        `Khi ai đó scan QR của vật phẩm,\nbạn sẽ nhận thông báo vị trí ngay lập tức.\n\n` +
        `Để hủy báo mất: 16store.app/passport/${asset?.qr_code}`,
    });

    revalidatePath('/dashboard');
    revalidatePath(`/passport/${asset?.qr_code}`);

    return {
      success: true,
      recovery_id: data.recovery_id,
      toast: {
        type: 'success',
        title: '🚨 Đã báo mất thành công',
        message:
          `Vật phẩm đã được đưa vào danh sách báo mất.\n\n` +
          `• Mọi giao dịch chuyển nhượng bị khóa ngay lập tức\n` +
          `• Khi ai scan QR, bạn nhận thông báo vị trí\n` +
          `• Phần thưởng cho người tìm: ${rewardAmount} HLR\n\n` +
          `Hãy thông báo cho bạn bè và cộng đồng 16Store!`,
      },
    };
  } catch (err) {
    console.error('[reportLost] Unexpected error:', err);
    return {
      success: false,
      toast: {
        type: 'error',
        title: 'Lỗi không xác định',
        message: err instanceof Error ? err.message : 'Vui lòng thử lại.',
      },
    };
  }
}

// ── Step 2: Finder báo tìm thấy ──────────────────────────────

/**
 * Người tìm thấy scan QR vật phẩm bị mất.
 * → Ghi vị trí tìm thấy
 * → Cộng HLR ngay lập tức
 * → Notify owner vị trí người tìm (ẩn danh một phần)
 */
export async function reportFound(input: {
  assetId: string;
  foundLat?: number;
  foundLng?: number;
  note?: string;
}): Promise<ReportFoundResult> {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();

    if (!authUser) {
      return {
        success: false,
        toast: {
          type: 'warning',
          title: '⚠️ Chưa đăng nhập',
          message:
            'Đăng nhập để báo tìm thấy và nhận phần thưởng HLR!\n' +
            'Bạn đang giúp chủ nhân tìm lại vật quý giá.',
        },
      };
    }

    const { data: userProfile } = await authClient
      .from('users_view')
      .select('id, handle, display_name')
      .eq('auth_id', authUser.id)
      .single();

    if (!userProfile) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Lỗi hồ sơ',
          message: 'Không tìm thấy hồ sơ người dùng.',
        },
      };
    }

    const supabase = createServiceClient();

    // Gọi DB function report_found()
    const { data, error } = await supabase
      .rpc('report_found', {
        p_asset_id:  input.assetId,
        p_finder_id: userProfile.id,
        p_found_lat: input.foundLat ?? null,
        p_found_lng: input.foundLng ?? null,
        p_note:      input.note ?? null,
      })
      .single();

    if (error) {
      console.error('[reportFound] RPC error:', error);
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Lỗi hệ thống',
          message: 'Không thể gửi báo cáo. Vui lòng thử lại.',
        },
      };
    }

    if (!data.success) {
      return {
        success: false,
        toast: {
          type: 'warning',
          title: '⚠️ Không thể báo tìm thấy',
          message: data.error ?? 'Thao tác thất bại.',
        },
      };
    }

    const rewardHlr = data.reward_hlr ?? 50;

    // Lấy asset + owner info để notify
    const { data: asset } = await supabase
      .from('universal_assets')
      .select('qr_code, object_type, attributes, owner_id')
      .eq('id', input.assetId)
      .single();

    const attrs = (asset?.attributes as any) ?? {};

    // Notify owner — vị trí tìm thấy (ẩn danh handle finder)
    if (data.owner_id) {
      const locationInfo = input.foundLat
        ? `📍 Vị trí: ${input.foundLat.toFixed(4)}, ${input.foundLng?.toFixed(4)}`
        : '📍 Vị trí: Không xác định';

      await sendNotification({
        user_id: data.owner_id,
        event: 'shoe_scan_lost' as any,
        payload: {
          asset_id: input.assetId,
          finder_id: userProfile.id,
          found_lat: input.foundLat,
          found_lng: input.foundLng,
        },
        message:
          `🎉 <b>Vật phẩm của bạn có thể đã được tìm thấy!</b>\n\n` +
          `${attrs.brand ?? ''} ${attrs.model ?? ''}\n` +
          `QR: <code>${asset?.qr_code ?? '-'}</code>\n\n` +
          `${locationInfo}\n` +
          `🕒 Lúc: ${new Date().toLocaleString('vi-VN')}\n\n` +
          (input.note ? `💬 Ghi chú: "${input.note}"\n\n` : '') +
          `16Store đã kết nối với người tìm thấy.\n` +
          `Hãy vào app để xác nhận và liên lạc.\n\n` +
          `🔗 16store.app/passport/${asset?.qr_code}`,
      });
    }

    // Notify finder — confirm reward
    await sendNotification({
      user_id: userProfile.id,
      event: 'post_verified' as any,
      payload: { asset_id: input.assetId, reward: rewardHlr },
      message:
        `🏆 <b>Cảm ơn bạn đã báo tìm thấy!</b>\n\n` +
        `Bạn vừa được cộng <b>${rewardHlr} HLR</b> vào tài khoản.\n\n` +
        `${attrs.brand ?? ''} ${attrs.model ?? ''}\n\n` +
        `Chủ nhân đã được thông báo và sẽ liên hệ với bạn qua 16Store.\n` +
        `Cảm ơn bạn đã đóng góp cho cộng đồng! 🙏`,
    });

    return {
      success: true,
      reward: {
        hlr_amount: rewardHlr,
        message: `${rewardHlr} HLR đã được cộng vào tài khoản của bạn!`,
      },
      toast: {
        type: 'success',
        title: `🏆 Cảm ơn! +${rewardHlr} HLR`,
        message:
          `Bạn đã báo tìm thấy thành công!\n\n` +
          `• ${rewardHlr} HLR đã được cộng vào tài khoản\n` +
          `• Chủ nhân đã được thông báo vị trí\n` +
          `• 16Store sẽ làm trung gian kết nối 2 bên\n\n` +
          `Cảm ơn bạn đã lan toa lòng tốt! 💙`,
      },
    };
  } catch (err) {
    console.error('[reportFound] Unexpected error:', err);
    return {
      success: false,
      toast: {
        type: 'error',
        title: 'Lỗi không xác định',
        message: err instanceof Error ? err.message : 'Vui lòng thử lại.',
      },
    };
  }
}

// ── Step 3: Owner xác nhận đã nhận lại ───────────────────────

/**
 * Owner xác nhận đã lấy lại được vật phẩm.
 * → is_lost = false
 * → Mở lại transfer
 * → Finalize reward cho finder
 */
export async function confirmRecovery(input: {
  assetId: string;
  recoveryId: string;
}): Promise<ConfirmRecoveryResult> {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();

    if (!authUser) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Chưa đăng nhập',
          message: 'Bạn cần đăng nhập để xác nhận.',
        },
      };
    }

    const { data: userProfile } = await authClient
      .from('users_view')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    const supabase = createServiceClient();

    // Verify owner
    const { data: asset } = await supabase
      .from('universal_assets')
      .select('id, qr_code, owner_id, attributes')
      .eq('id', input.assetId)
      .single();

    if (!asset || asset.owner_id !== userProfile?.id) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Không có quyền',
          message: 'Chỉ chủ sở hữu mới có thể xác nhận đã nhận lại vật phẩm.',
        },
      };
    }

    // Lấy recovery log + finder info
    const { data: recovery } = await supabase
      .from('lost_recovery_log')
      .select('finder_id, reward_hlr, status')
      .eq('id', input.recoveryId)
      .single();

    if (!recovery || recovery.status === 'cancelled') {
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Không tìm thấy báo cáo',
          message: 'Báo cáo mất đồ không tồn tại hoặc đã bị hủy.',
        },
      };
    }

    // Unlock asset
    await supabase
      .from('universal_assets')
      .update({
        is_lost: false,
        found_at: new Date().toISOString(),
        transfer_status: 'locked',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.assetId);

    // Finalize recovery log
    await supabase
      .from('lost_recovery_log')
      .update({
        status: 'found',
        reward_paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.recoveryId);

    const attrs = (asset.attributes as any) ?? {};

    // Notify finder — final confirmation
    if (recovery.finder_id) {
      await sendNotification({
        user_id: recovery.finder_id,
        event: 'post_verified' as any,
        payload: { asset_id: input.assetId },
        message:
          `✅ <b>Chủ nhân đã xác nhận nhận lại vật phẩm!</b>\n\n` +
          `${attrs.brand ?? ''} ${attrs.model ?? ''}\n\n` +
          `Phần thưởng <b>${recovery.reward_hlr} HLR</b> đã được xác nhận.\n` +
          `Cảm ơn hành động đẹp của bạn! 🙏\n\n` +
          `Bạn đã tạo nên một câu chuyện đáng nhớ.`,
      });
    }

    revalidatePath('/dashboard');
    revalidatePath(`/passport/${asset.qr_code}`);

    return {
      success: true,
      toast: {
        type: 'success',
        title: '✅ Đã xác nhận nhận lại',
        message:
          `Vật phẩm đã được đánh dấu là tìm thấy.\n` +
          `Cảm ơn cộng đồng 16Store đã giúp bạn! 🎉`,
      },
    };
  } catch (err) {
    console.error('[confirmRecovery] Error:', err);
    return {
      success: false,
      toast: {
        type: 'error',
        title: 'Lỗi',
        message: err instanceof Error ? err.message : 'Vui lòng thử lại.',
      },
    };
  }
}

// ── Cancel lost report ────────────────────────────────────────

/**
 * Owner hủy báo mất (tìm thấy theo cách khác)
 * → is_lost = false, mở lại transfer
 */
export async function cancelLostReport(
  assetId: string
): Promise<CancelLostResult> {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();

    if (!authUser) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Chưa đăng nhập',
          message: 'Bạn cần đăng nhập để hủy báo mất.',
        },
      };
    }

    const { data: userProfile } = await authClient
      .from('users_view')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    const supabase = createServiceClient();

    // Verify owner
    const { data: asset } = await supabase
      .from('universal_assets')
      .select('owner_id, qr_code')
      .eq('id', assetId)
      .single();

    if (!asset || asset.owner_id !== userProfile?.id) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Không có quyền',
          message: 'Chỉ chủ sở hữu mới có thể hủy báo mất.',
        },
      };
    }

    // Unlock
    await supabase
      .from('universal_assets')
      .update({
        is_lost: false,
        found_at: new Date().toISOString(),
        transfer_status: 'locked',
        updated_at: new Date().toISOString(),
      })
      .eq('id', assetId);

    // Cancel recovery log
    await supabase
      .from('lost_recovery_log')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('asset_id', assetId)
      .eq('status', 'active');

    revalidatePath('/dashboard');
    revalidatePath(`/passport/${asset.qr_code}`);

    return {
      success: true,
      toast: {
        type: 'success',
        title: '✅ Đã hủy báo mất',
        message:
          'Vật phẩm đã được đánh dấu là tìm thấy.\n' +
          'Các chức năng giao dịch đã được mở lại.',
      },
    };
  } catch (err) {
    console.error('[cancelLostReport] Error:', err);
    return {
      success: false,
      toast: {
        type: 'error',
        title: 'Lỗi',
        message: err instanceof Error ? err.message : 'Vui lòng thử lại.',
      },
    };
  }
}
