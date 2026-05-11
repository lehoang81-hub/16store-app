'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendNotification } from '@/lib/telegram/send';
import { revalidatePath } from 'next/cache';

// ── Types ─────────────────────────────────────────────────────

export interface InitiateTransferResult {
  success: boolean;
  token?: {
    id: string;
    code: string;
    expires_at: string;
    expires_in_minutes: number;
    qr_data: string;      // JSON string để gen QR code
  };
  toast: {
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  };
}

export interface VerifyTransferResult {
  success: boolean;
  // AI verification result (trước khi confirm)
  verification?: {
    similarity: number;
    similarity_pct: string;
    is_match: boolean;
    verdict: string;
  };
  toast: {
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  };
}

export interface ConfirmTransferResult {
  success: boolean;
  transfer?: {
    asset_id: string;
    from_owner: string;
    to_owner: string;
    completed_at: string;
  };
  toast: {
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  };
}

export interface CancelTransferResult {
  success: boolean;
  toast: {
    type: 'success' | 'error';
    title: string;
    message: string;
  };
}

// ── Step 1: Seller tạo Transfer Token ─────────────────────────

/**
 * Seller bấm "Tạo mã chuyển nhượng"
 * → Gọi initiate_transfer() DB function
 * → Trả về one-time token (15 phút)
 */
export async function initiateTransfer(
  assetId: string,
  validMinutes: number = 15
): Promise<InitiateTransferResult> {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();

    if (!authUser) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Chưa đăng nhập',
          message: 'Bạn cần đăng nhập để tạo mã chuyển nhượng.',
        },
      };
    }

    // Lấy user_id từ users_view (auth_id → user_id)
    const { data: userProfile } = await authClient
      .from('users_view')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!userProfile) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Không tìm thấy hồ sơ',
          message: 'Hồ sơ người dùng không tồn tại.',
        },
      };
    }

    const supabase = createServiceClient();

    // Gọi DB function
    const { data, error } = await supabase
      .rpc('initiate_transfer', {
        p_asset_id: assetId,
        p_seller_id: userProfile.id,
        p_minutes: validMinutes,
      })
      .single();

    if (error) {
      console.error('[initiateTransfer] RPC error:', error);
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Lỗi hệ thống',
          message: 'Không thể tạo mã chuyển nhượng. Vui lòng thử lại.',
        },
      };
    }

    // DB function trả về error message trong field 'error'
    if (data.error) {
      // Phân loại toast type theo nội dung lỗi
      const isWarning =
        data.error.includes('đang báo mất') ||
        data.error.includes('giao dịch khác');

      return {
        success: false,
        toast: {
          type: isWarning ? 'warning' : 'error',
          title: isWarning ? 'Không thể chuyển nhượng' : 'Lỗi',
          message: data.error,
        },
      };
    }

    const expiresAt = new Date(data.expires_at);
    const now = new Date();
    const expiresInMs = expiresAt.getTime() - now.getTime();
    const expiresInMinutes = Math.floor(expiresInMs / 60000);

    // QR data — buyer sẽ scan cái này
    const qrData = JSON.stringify({
      type: '16STORE_TRANSFER',
      token: data.token_code,
      asset_qr: data.asset_qr,
      expires_at: data.expires_at,
    });

    return {
      success: true,
      token: {
        id: data.token_id,
        code: data.token_code,
        expires_at: data.expires_at,
        expires_in_minutes: expiresInMinutes,
        qr_data: qrData,
      },
      toast: {
        type: 'success',
        title: '✅ Mã chuyển nhượng đã tạo',
        message:
          `Mã có hiệu lực trong ${expiresInMinutes} phút.\n` +
          `Yêu cầu người mua quét mã này và xác thực vật phẩm thực tế.`,
      },
    };
  } catch (err) {
    console.error('[initiateTransfer] Unexpected error:', err);
    return {
      success: false,
      toast: {
        type: 'error',
        title: 'Lỗi không xác định',
        message: err instanceof Error ? err.message : 'Đã xảy ra lỗi. Vui lòng thử lại.',
      },
    };
  }
}

// ── Step 2: Buyer verify AI trước khi confirm ─────────────────

/**
 * Buyer quét vật phẩm thực tế để AI so sánh
 * → Chỉ verify, chưa confirm transfer
 * → Trả về similarity score để buyer quyết định
 */
export async function verifyTransferItem(input: {
  tokenCode: string;
  aiSimilarity: number;     // 0.0 - 1.0 từ CLIP model
  buyerLat?: number;
  buyerLng?: number;
}): Promise<VerifyTransferResult> {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();

    if (!authUser) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Chưa đăng nhập',
          message: 'Bạn cần đăng nhập để xác thực vật phẩm.',
        },
      };
    }

    const supabase = createServiceClient();

    // Kiểm tra token còn hợp lệ không
    const { data: token } = await supabase
      .from('transfer_tokens')
      .select(`
        id, token_code, status, expires_at, asset_id,
        universal_assets (
          id, qr_code, is_lost, transfer_status,
          object_type, attributes, security_tier,
          vector_embedding
        )
      `)
      .eq('token_code', input.tokenCode)
      .single();

    if (!token) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: '❌ Mã không hợp lệ',
          message:
            'Mã chuyển nhượng không tồn tại.\n' +
            'Vui lòng yêu cầu người bán tạo mã mới.',
        },
      };
    }

    if (token.status !== 'active') {
      return {
        success: false,
        toast: {
          type: 'error',
          title: '❌ Mã đã hết hạn',
          message:
            `Mã chuyển nhượng đã ${token.status === 'used' ? 'được dùng rồi' : 'hết hạn'}.\n` +
            'Yêu cầu người bán tạo mã mới.',
        },
      };
    }

    if (new Date(token.expires_at) < new Date()) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: '⏰ Mã đã hết thời hạn',
          message:
            'Mã chuyển nhượng đã hết hiệu lực.\n' +
            'Yêu cầu người bán tạo mã mới (mỗi mã chỉ có hiệu lực 15 phút).',
        },
      };
    }

    const asset = (token as any).universal_assets;

    // Check đồ đang bị báo mất
    if (asset?.is_lost) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: '🚨 VẬT PHẨM BỊ BÁO MẤT/TRỘM!',
          message:
            'CẢNH BÁO NGHIÊM TRỌNG: Vật phẩm này đang trong danh sách báo mất.\n\n' +
            'Không tiếp tục giao dịch!\n' +
            'Hệ thống đã ghi nhận sự kiện này. ' +
            'Nếu bạn đang bị lừa, hãy báo cáo ngay cho 16Store.',
        },
      };
    }

    // AI Similarity verdict
    const similarityPct = (input.aiSimilarity * 100).toFixed(1);
    const isMatch = input.aiSimilarity >= 0.90;

    if (!isMatch) {
      return {
        success: false,
        verification: {
          similarity: input.aiSimilarity,
          similarity_pct: `${similarityPct}%`,
          is_match: false,
          verdict: 'mismatch',
        },
        toast: {
          type: 'error',
          title: `🚨 CẢNH BÁO: Vật phẩm KHÔNG KHỚP! (${similarityPct}%)`,
          message:
            `AI phát hiện vật phẩm này KHÔNG KHỚP với dữ liệu gốc.\n` +
            `Độ tương đồng: ${similarityPct}% (yêu cầu ≥ 90%)\n\n` +
            `Nguy cơ: Có thể bạn đang bị tráo đổi đồ giả.\n` +
            `Giao dịch bị từ chối tự động để bảo vệ bạn.\n` +
            `Nếu nghi ngờ bị lừa đảo, hãy báo cáo ngay cho 16Store.`,
        },
      };
    }

    return {
      success: true,
      verification: {
        similarity: input.aiSimilarity,
        similarity_pct: `${similarityPct}%`,
        is_match: true,
        verdict: 'match',
      },
      toast: {
        type: 'success',
        title: `✅ Xác thực thành công (${similarityPct}%)`,
        message:
          `AI xác nhận vật phẩm khớp với dữ liệu gốc.\n` +
          `Độ tương đồng: ${similarityPct}%\n\n` +
          `Bạn có thể tiến hành xác nhận giao dịch.`,
      },
    };
  } catch (err) {
    console.error('[verifyTransferItem] Error:', err);
    return {
      success: false,
      toast: {
        type: 'error',
        title: 'Lỗi xác thực',
        message: err instanceof Error ? err.message : 'Không thể xác thực vật phẩm.',
      },
    };
  }
}

// ── Step 3: Confirm transfer (Atomic) ─────────────────────────

/**
 * Buyer xác nhận sau khi AI verify thành công
 * → Gọi transfer_asset() DB function (Atomic)
 * → Cleanup tokens cũ
 * → Notify cả 2 bên
 */
export async function confirmTransfer(input: {
  tokenCode: string;
  aiSimilarity: number;
  buyerLat?: number;
  buyerLng?: number;
}): Promise<ConfirmTransferResult> {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();

    if (!authUser) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Chưa đăng nhập',
          message: 'Bạn cần đăng nhập để xác nhận giao dịch.',
        },
      };
    }

    // Safety check: AI similarity phải đạt ngưỡng
    if (input.aiSimilarity < 0.90) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: '🚨 Không thể xác nhận',
          message:
            `Vật phẩm không đạt ngưỡng xác thực AI (${(input.aiSimilarity * 100).toFixed(1)}%).\n` +
            'Giao dịch bị từ chối để bảo vệ bạn.',
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
          title: 'Không tìm thấy hồ sơ',
          message: 'Hồ sơ người dùng không tồn tại.',
        },
      };
    }

    const supabase = createServiceClient();

    // Atomic transfer via DB function
    const { data, error } = await supabase
      .rpc('transfer_asset', {
        p_token_code:    input.tokenCode,
        p_buyer_id:      userProfile.id,
        p_ai_similarity: input.aiSimilarity,
        p_buyer_lat:     input.buyerLat ?? null,
        p_buyer_lng:     input.buyerLng ?? null,
      })
      .single();

    if (error) {
      console.error('[confirmTransfer] RPC error:', error);
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Lỗi hệ thống',
          message: 'Giao dịch thất bại. Không có thay đổi nào được thực hiện.',
        },
      };
    }

    if (!data.success) {
      // Phân loại cảnh báo
      const isFraud =
        data.error?.includes('CẢNH BÁO') ||
        data.error?.includes('KHÔNG KHỚP') ||
        data.error?.includes('bị tráo');

      return {
        success: false,
        toast: {
          type: isFraud ? 'error' : 'warning',
          title: isFraud ? '🚨 Giao dịch bị từ chối — Nghi ngờ gian lận' : '⚠️ Không thể hoàn tất',
          message: data.error ?? 'Giao dịch thất bại.',
        },
      };
    }

    // Lấy thông tin để notify
    const { data: asset } = await supabase
      .from('universal_assets')
      .select('qr_code, object_type, attributes, owner_id')
      .eq('id', data.asset_id)
      .single();

    // Lấy seller info từ token
    const { data: usedToken } = await supabase
      .from('transfer_tokens')
      .select('seller_id')
      .eq('token_code', input.tokenCode)
      .single();

    const completedAt = new Date().toISOString();
    const attrs = (asset?.attributes as any) ?? {};

    // Notify buyer
    await sendNotification({
      user_id: userProfile.id,
      event: 'post_sold' as any,
      payload: { asset_id: data.asset_id, qr_code: asset?.qr_code },
      message:
        `🎉 <b>Giao dịch hoàn tất!</b>\n\n` +
        `Bạn đã nhận được:\n` +
        `${attrs.brand ?? ''} ${attrs.model ?? ''}\n` +
        `QR: <code>${asset?.qr_code ?? '-'}</code>\n\n` +
        `AI xác thực: ${(input.aiSimilarity * 100).toFixed(1)}% ✅\n` +
        `Lịch sử sở hữu đã được cập nhật.\n\n` +
        `🔗 16store.app/passport/${asset?.qr_code}`,
    });

    // Notify seller
    if (usedToken?.seller_id) {
      await sendNotification({
        user_id: usedToken.seller_id,
        event: 'post_sold' as any,
        payload: { asset_id: data.asset_id },
        message:
          `💸 <b>Vật phẩm đã được chuyển nhượng thành công!</b>\n\n` +
          `${attrs.brand ?? ''} ${attrs.model ?? ''}\n` +
          `QR: <code>${asset?.qr_code ?? '-'}</code>\n\n` +
          `Người nhận: @${userProfile.handle ?? 'unknown'}\n` +
          `AI xác thực: ${(input.aiSimilarity * 100).toFixed(1)}% ✅\n` +
          `Giao dịch được ghi vào sổ cái vĩnh viễn.`,
      });
    }

    revalidatePath('/dashboard');
    revalidatePath(`/passport/${asset?.qr_code}`);

    return {
      success: true,
      transfer: {
        asset_id: data.asset_id,
        from_owner: usedToken?.seller_id ?? 'unknown',
        to_owner: userProfile.id,
        completed_at: completedAt,
      },
      toast: {
        type: 'success',
        title: '🎉 Chuyển nhượng thành công!',
        message:
          `Vật phẩm đã được chuyển sang tên bạn.\n` +
          `AI xác thực: ${(input.aiSimilarity * 100).toFixed(1)}%\n` +
          `Lịch sử sở hữu đã được cập nhật vĩnh viễn.`,
      },
    };
  } catch (err) {
    console.error('[confirmTransfer] Unexpected error:', err);
    return {
      success: false,
      toast: {
        type: 'error',
        title: 'Lỗi không xác định',
        message:
          'Đã xảy ra lỗi trong quá trình xác nhận giao dịch.\n' +
          'Không có thay đổi nào được thực hiện. Vui lòng thử lại.',
      },
    };
  }
}

// ── Cancel transfer ───────────────────────────────────────────

export async function cancelTransfer(
  assetId: string
): Promise<CancelTransferResult> {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();

    if (!authUser) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Chưa đăng nhập',
          message: 'Bạn cần đăng nhập để hủy giao dịch.',
        },
      };
    }

    const { data: userProfile } = await authClient
      .from('users_view')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!userProfile) {
      return {
        success: false,
        toast: { type: 'error', title: 'Lỗi', message: 'Không tìm thấy hồ sơ.' },
      };
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .rpc('cancel_transfer', {
        p_asset_id:  assetId,
        p_seller_id: userProfile.id,
      })
      .single();

    if (error || !data.success) {
      return {
        success: false,
        toast: {
          type: 'error',
          title: 'Không thể hủy',
          message: data?.error ?? 'Không thể hủy giao dịch.',
        },
      };
    }

    revalidatePath('/dashboard');

    return {
      success: true,
      toast: {
        type: 'success',
        title: '✅ Đã hủy giao dịch',
        message: 'Mã chuyển nhượng đã bị thu hồi. Vật phẩm đã được khóa lại.',
      },
    };
  } catch (err) {
    console.error('[cancelTransfer] Error:', err);
    return {
      success: false,
      toast: {
        type: 'error',
        title: 'Lỗi',
        message: 'Không thể hủy giao dịch. Vui lòng thử lại.',
      },
    };
  }
}
