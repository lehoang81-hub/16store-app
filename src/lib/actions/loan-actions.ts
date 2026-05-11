'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendNotification } from '@/lib/telegram/send';
import { revalidatePath } from 'next/cache';

// ── Types ─────────────────────────────────────────────────────

export interface LoanToast {
  type: 'success' | 'error' | 'warning';
  title: string;
  message: string;
}

export interface InitiateLoanInput {
  assetId: string;
  borrowerHandle: string;
  weeks: number;
  weeklyHlrRate: number;
  loanNote?: string;
  maxDistanceKm?: number;
  allowSubloan?: boolean;
  handoverContext?: string;    // Hoàn cảnh cho mượn
  handoverLocation?: string;   // Địa điểm bàn giao
  handoverImageUrls?: string[]; // Ảnh bàn giao (max 2)
}

export interface InitiateLoanResult {
  success: boolean;
  loanId?: string;
  toast: LoanToast;
}

export interface ConfirmLoanResult {
  success: boolean;
  toast: LoanToast;
}

export interface ReturnLoanResult {
  success: boolean;
  bonusHlr?: number;
  distanceKm?: number;
  toast: LoanToast;
}

export interface EscalateLoanResult {
  success: boolean;
  toast: LoanToast;
}

// ── Step 1: Owner tạo loan ────────────────────────────────────

export async function initiateLoan(
  input: InitiateLoanInput
): Promise<InitiateLoanResult> {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) return {
      success: false,
      toast: { type: 'error', title: 'Chưa đăng nhập', message: 'Bạn cần đăng nhập để cho mượn.' },
    };

    const { data: ownerProfile } = await authClient
      .from('users_view')
      .select('id, handle')
      .eq('auth_id', authUser.id)
      .single();

    if (!ownerProfile) return {
      success: false,
      toast: { type: 'error', title: 'Lỗi hồ sơ', message: 'Không tìm thấy thông tin người dùng.' },
    };

    const supabase = createServiceClient();

    // Tìm borrower theo handle — chỉ lấy id, handle từ users_view
    const cleanHandle = input.borrowerHandle.replace('@', '').trim();
    const { data: borrowerView } = await supabase
      .from('users_view')
      .select('id, handle')
      .eq('handle', cleanHandle)
      .single();

    if (!borrowerView) return {
      success: false,
      toast: {
        type: 'error',
        title: 'Không tìm thấy người dùng',
        message: `@${cleanHandle} không tồn tại trên hệ thống.`,
      },
    };

    // Get borrower HLR từ users table
    const { data: borrowerFull } = await supabase
      .from('users')
      .select('reward_points, display_name')
      .eq('user_id', borrowerView.id)
      .single();

    const borrower = {
      id:             borrowerView.id,
      handle:         borrowerView.handle,
      display_name:   borrowerFull?.display_name ?? borrowerView.handle,
      reward_points:  borrowerFull?.reward_points ?? 0,
    };

    // Check borrower không phải chính mình
    if (borrower.id === ownerProfile.id) return {
      success: false,
      toast: { type: 'error', title: 'Không hợp lệ', message: 'Bạn không thể cho chính mình mượn.' },
    };

    // Check borrower đủ HLR tuần đầu
    if ((borrower.reward_points ?? 0) < input.weeklyHlrRate) return {
      success: false,
      toast: {
        type: 'warning',
        title: '⚠️ Người mượn không đủ HLR',
        message:
          `@${cleanHandle} chỉ có ${borrower.reward_points ?? 0} HLR.\n` +
          `Cần ít nhất ${input.weeklyHlrRate} HLR cho tuần đầu.`,
      },
    };

    // Validate
    if (input.weeks < 1 || input.weeks > 52) return {
      success: false,
      toast: { type: 'error', title: 'Số tuần không hợp lệ', message: 'Chọn từ 1 đến 52 tuần.' },
    };
    if (input.weeklyHlrRate < 1) return {
      success: false,
      toast: { type: 'error', title: 'Rate không hợp lệ', message: 'Rate tối thiểu 1 HLR/tuần.' },
    };

    // Gọi DB function
    const { data, error } = await supabase
      .rpc('initiate_loan', {
        p_asset_id:        input.assetId,
        p_owner_id:        ownerProfile.id,
        p_borrower_id:     borrower.id,
        p_weeks:           input.weeks,
        p_weekly_hlr_rate: input.weeklyHlrRate,
        p_loan_note:       input.loanNote ?? null,
        p_max_distance_km: input.maxDistanceKm ?? null,
      })
      .single();

    // Save handover context/location/images nếu có
    if (data?.loan_id && (input.handoverContext || input.handoverLocation || input.handoverImageUrls?.length)) {
      await supabase
        .from('asset_loans')
        .update({
          handover_context:    input.handoverContext ?? null,
          handover_location:   input.handoverLocation ?? null,
          handover_image_urls: input.handoverImageUrls ?? [],
        })
        .eq('id', data.loan_id);
    }

    if (error || !data) {
      console.error('[initiateLoan] RPC error:', error);
      return {
        success: false,
        toast: { type: 'error', title: 'Lỗi hệ thống', message: 'Không thể tạo loan. Vui lòng thử lại.' },
      };
    }

    if (data.error) return {
      success: false,
      toast: {
        type: data.error.includes('không đủ') ? 'warning' : 'error',
        title: 'Không thể cho mượn',
        message: data.error,
      },
    };

    // Lấy asset info để notify
    const { data: asset } = await supabase
      .from('universal_assets')
      .select('qr_code, brand, model, object_type, attributes')
      .eq('id', input.assetId)
      .single();

    const attrs = (asset?.attributes as any) ?? {};
    const itemName = `${attrs.brand ?? asset?.brand ?? ''} ${attrs.model ?? asset?.model ?? ''}`.trim();
    const dueDate = new Date(Date.now() + input.weeks * 7 * 24 * 3600 * 1000)
      .toLocaleDateString('vi-VN');

    // Notify borrower
    await sendNotification({
      user_id: borrower.id,
      event: 'post_submitted' as any,
      payload: { loan_id: data.loan_id, asset_id: input.assetId },
      message:
        `🤝 <b>Bạn được mời mượn vật phẩm!</b>\n\n` +
        `${itemName}\n` +
        `Từ: @${ownerProfile.handle}\n\n` +
        `💰 Phí: ${input.weeklyHlrRate} HLR/tuần\n` +
        `⏰ Thời hạn: ${input.weeks} tuần (đến ${dueDate})\n\n` +
        (input.loanNote ? `📋 Điều kiện: ${input.loanNote}\n\n` : '') +
        `Scan QR vật phẩm để xác nhận nhận đồ.\n` +
        `🔗 16store.app/passport/${asset?.qr_code}`,
    });

    revalidatePath('/dashboard');
    revalidatePath(`/passport/${asset?.qr_code}`);

    return {
      success: true,
      loanId: data.loan_id,
      toast: {
        type: 'success',
        title: '✅ Đã gửi yêu cầu cho mượn',
        message:
          `@${cleanHandle} sẽ nhận thông báo qua Telegram.\n` +
          `Phí: ${input.weeklyHlrRate} HLR/tuần × ${input.weeks} tuần\n` +
          `Bạn nhận: ${Math.round(input.weeklyHlrRate * 0.53)} HLR/tuần`,
      },
    };
  } catch (err) {
    console.error('[initiateLoan]', err);
    return {
      success: false,
      toast: { type: 'error', title: 'Lỗi không xác định', message: String(err) },
    };
  }
}

// ── Step 2: Borrower xác nhận nhận đồ ────────────────────────

export async function confirmLoan(input: {
  loanId: string;
  lat?: number;
  lng?: number;
  accuracyM?: number;
}): Promise<ConfirmLoanResult> {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) return {
      success: false,
      toast: { type: 'error', title: 'Chưa đăng nhập', message: 'Bạn cần đăng nhập.' },
    };

    const { data: userProfile } = await authClient
      .from('users_view')
      .select('id, handle')
      .eq('auth_id', authUser.id)
      .single();

    if (!userProfile) return {
      success: false,
      toast: { type: 'error', title: 'Lỗi hồ sơ', message: 'Không tìm thấy hồ sơ.' },
    };

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .rpc('confirm_loan', {
        p_loan_id:     input.loanId,
        p_borrower_id: userProfile.id,
        p_lat:         input.lat ?? null,
        p_lng:         input.lng ?? null,
        p_accuracy_m:  input.accuracyM ?? null,
      })
      .single();

    if (error || !data) {
      console.error('[confirmLoan] RPC error:', error);
      return {
        success: false,
        toast: { type: 'error', title: 'Lỗi hệ thống', message: 'Không thể xác nhận. Vui lòng thử lại.' },
      };
    }

    if (!data.success) return {
      success: false,
      toast: { type: 'error', title: 'Xác nhận thất bại', message: data.error ?? 'Lỗi không xác định.' },
    };

    // Lấy loan info để notify owner
    const { data: loan } = await supabase
      .from('asset_loans')
      .select('owner_id, weekly_hlr_rate, owner_hlr_reward, due_at, asset_id')
      .eq('id', input.loanId)
      .single();

    if (loan?.owner_id) {
      const { data: asset } = await supabase
        .from('universal_assets')
        .select('qr_code, brand, model, attributes')
        .eq('id', loan.asset_id)
        .single();

      const attrs = (asset?.attributes as any) ?? {};
      const itemName = `${attrs.brand ?? asset?.brand ?? ''} ${attrs.model ?? asset?.model ?? ''}`.trim();
      const locationStr = input.lat
        ? `📍 ${input.lat.toFixed(4)}°N, ${input.lng?.toFixed(4)}°E`
        : '📍 Vị trí không xác định';

      await sendNotification({
        user_id: loan.owner_id,
        event: 'post_verified' as any,
        payload: { loan_id: input.loanId },
        message:
          `✅ <b>@${userProfile.handle} đã xác nhận nhận đồ!</b>\n\n` +
          `${itemName}\n\n` +
          `${locationStr}\n` +
          `🕒 ${new Date().toLocaleString('vi-VN')}\n\n` +
          `💰 Tuần 1: -${loan.weekly_hlr_rate} HLR (bạn nhận +${loan.owner_hlr_reward} HLR)\n` +
          `⏰ Hạn trả: ${new Date(loan.due_at).toLocaleDateString('vi-VN')}\n\n` +
          `🔐 Spatial fingerprint đã ghi nhận — căn cứ pháp lý số hợp lệ.`,
      });
    }

    revalidatePath('/dashboard');

    return {
      success: true,
      toast: {
        type: 'success',
        title: '✅ Đã xác nhận nhận đồ',
        message:
          `Tuần đầu đã được tính phí.\n` +
          (input.lat ? `Vị trí bàn giao đã ghi nhận.\n` : '') +
          `Nhớ trả đúng hạn để nhận +5 HLR bonus!`,
      },
    };
  } catch (err) {
    console.error('[confirmLoan]', err);
    return {
      success: false,
      toast: { type: 'error', title: 'Lỗi', message: String(err) },
    };
  }
}

// ── Step 3: Borrower trả đồ ───────────────────────────────────

export async function returnLoan(input: {
  loanId: string;
  lat?: number;
  lng?: number;
  accuracyM?: number;
}): Promise<ReturnLoanResult> {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) return {
      success: false,
      toast: { type: 'error', title: 'Chưa đăng nhập', message: 'Bạn cần đăng nhập.' },
    };

    const { data: userProfile } = await authClient
      .from('users_view')
      .select('id, handle')
      .eq('auth_id', authUser.id)
      .single();

    if (!userProfile) return {
      success: false,
      toast: { type: 'error', title: 'Lỗi hồ sơ', message: 'Không tìm thấy hồ sơ.' },
    };

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .rpc('return_loan', {
        p_loan_id:     input.loanId,
        p_borrower_id: userProfile.id,
        p_lat:         input.lat ?? null,
        p_lng:         input.lng ?? null,
        p_accuracy_m:  input.accuracyM ?? null,
      })
      .single();

    if (error || !data) {
      console.error('[returnLoan] RPC error:', error);
      return {
        success: false,
        toast: { type: 'error', title: 'Lỗi hệ thống', message: 'Không thể xác nhận trả. Vui lòng thử lại.' },
      };
    }

    if (!data.success) return {
      success: false,
      toast: { type: 'error', title: 'Trả đồ thất bại', message: data.error ?? 'Lỗi không xác định.' },
    };

    const bonusHlr = data.bonus_hlr ?? 0;

    // Lấy loan để notify owner + tính distance
    const { data: loan } = await supabase
      .from('asset_loans')
      .select('owner_id, handover_lat, handover_lng, asset_id, total_hlr_charged')
      .eq('id', input.loanId)
      .single();

    let distanceKm: number | undefined;
    if (loan?.handover_lat && input.lat) {
      const R = 6371;
      const dLat = ((input.lat - loan.handover_lat) * Math.PI) / 180;
      const dLng = ((input.lng! - loan.handover_lng) * Math.PI) / 180;
      const a = Math.sin(dLat/2)**2 +
        Math.cos(loan.handover_lat * Math.PI/180) *
        Math.cos(input.lat * Math.PI/180) *
        Math.sin(dLng/2)**2;
      distanceKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    }

    if (loan?.owner_id) {
      const { data: asset } = await supabase
        .from('universal_assets')
        .select('qr_code, brand, model, attributes')
        .eq('id', loan.asset_id)
        .single();

      const attrs = (asset?.attributes as any) ?? {};
      const itemName = `${attrs.brand ?? asset?.brand ?? ''} ${attrs.model ?? asset?.model ?? ''}`.trim();

      await sendNotification({
        user_id: loan.owner_id,
        event: 'post_verified' as any,
        payload: { loan_id: input.loanId },
        message:
          `🎉 <b>@${userProfile.handle} đã trả đồ!</b>\n\n` +
          `${itemName}\n\n` +
          `💰 Tổng HLR đã thu: ${loan.total_hlr_charged} HLR\n` +
          (distanceKm !== undefined ? `📍 Khoảng cách bàn giao ↔ trả: ${distanceKm}km\n` : '') +
          (bonusHlr > 0 ? `⭐ Borrower nhận +${bonusHlr} HLR bonus (trả đúng hạn)\n` : '') +
          `\nVật phẩm đã được mở khóa. Chào mừng trở về!`,
      });
    }

    revalidatePath('/dashboard');

    return {
      success: true,
      bonusHlr,
      distanceKm,
      toast: {
        type: 'success',
        title: bonusHlr > 0 ? `🎉 Trả đồ thành công! +${bonusHlr} HLR bonus` : '✅ Trả đồ thành công',
        message:
          (bonusHlr > 0 ? `Cảm ơn bạn đã trả đúng hạn!\n` : '') +
          (distanceKm !== undefined ? `Khoảng cách bàn giao ↔ trả: ${distanceKm}km\n` : '') +
          `Vật phẩm đã được trả về chủ nhân.`,
      },
    };
  } catch (err) {
    console.error('[returnLoan]', err);
    return {
      success: false,
      toast: { type: 'error', title: 'Lỗi', message: String(err) },
    };
  }
}

// ── Step 4: Owner escalate ────────────────────────────────────

export async function escalateLoan(input: {
  loanId: string;
  action: 'extend' | 'report_lost' | 'freeze';
}): Promise<EscalateLoanResult> {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) return {
      success: false,
      toast: { type: 'error', title: 'Chưa đăng nhập', message: 'Bạn cần đăng nhập.' },
    };

    const { data: userProfile } = await authClient
      .from('users_view')
      .select('id, handle')
      .eq('auth_id', authUser.id)
      .single();

    if (!userProfile) return {
      success: false,
      toast: { type: 'error', title: 'Lỗi hồ sơ', message: 'Không tìm thấy hồ sơ.' },
    };

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .rpc('escalate_loan', {
        p_loan_id:  input.loanId,
        p_owner_id: userProfile.id,
        p_action:   input.action,
      })
      .single();

    if (error || !data) {
      console.error('[escalateLoan] RPC error:', error);
      return {
        success: false,
        toast: { type: 'error', title: 'Lỗi hệ thống', message: 'Không thể thực hiện. Vui lòng thử lại.' },
      };
    }

    if (!data.success) return {
      success: false,
      toast: { type: 'error', title: 'Thất bại', message: data.error ?? 'Lỗi không xác định.' },
    };

    // Lấy borrower để notify
    const { data: loan } = await supabase
      .from('asset_loans')
      .select('borrower_id, asset_id, weekly_hlr_rate')
      .eq('id', input.loanId)
      .single();

    if (loan?.borrower_id) {
      const { data: asset } = await supabase
        .from('universal_assets')
        .select('qr_code, brand, model, attributes')
        .eq('id', loan.asset_id)
        .single();

      const attrs = (asset?.attributes as any) ?? {};
      const itemName = `${attrs.brand ?? asset?.brand ?? ''} ${attrs.model ?? asset?.model ?? ''}`.trim();

      const messages = {
        extend: `📅 <b>Chủ nhân đã gia hạn cho bạn thêm 1 tuần.</b>\n\n${itemName}\n\nVui lòng trả đồ sớm nhất có thể.`,
        report_lost:
          `🚨 <b>CẢNH BÁO: Chủ nhân đã báo mất vật phẩm!</b>\n\n${itemName}\n\n` +
          `Tài khoản của bạn bị trừ 20 điểm uy tín.\n` +
          `Vi phạm này được ghi vĩnh viễn vào hồ sơ.\n` +
          `Liên hệ admin nếu đây là nhầm lẫn.`,
        freeze:
          `🔒 <b>TÀI KHOẢN BỊ ĐÓNG BĂNG</b>\n\n` +
          `Do vi phạm nghiêm trọng liên quan đến ${itemName}.\n` +
          `Bạn không thể mượn bất kỳ vật phẩm nào cho đến khi được admin mở khóa.\n` +
          `Liên hệ: support@16store.app`,
      };

      await sendNotification({
        user_id: loan.borrower_id,
        event: 'post_submitted' as any,
        payload: { loan_id: input.loanId, action: input.action },
        message: messages[input.action],
      });
    }

    revalidatePath('/dashboard');

    const toasts = {
      extend: {
        type: 'success' as const,
        title: '✅ Đã gia hạn thêm 1 tuần',
        message: 'Người mượn đã được thông báo.',
      },
      report_lost: {
        type: 'warning' as const,
        title: '🚨 Đã báo mất vật phẩm',
        message: 'Người mượn bị trừ 20 điểm uy tín. Vi phạm ghi vĩnh viễn.',
      },
      freeze: {
        type: 'error' as const,
        title: '🔒 Đã đóng băng tài khoản',
        message: 'Người mượn không thể mượn bất kỳ thứ gì cho đến khi admin mở khóa.',
      },
    };

    return { success: true, toast: toasts[input.action] };
  } catch (err) {
    console.error('[escalateLoan]', err);
    return {
      success: false,
      toast: { type: 'error', title: 'Lỗi', message: String(err) },
    };
  }
}

// ── Query helpers ─────────────────────────────────────────────

export async function getMyLoans() {
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  if (!authUser) return { asOwner: [], asBorrower: [] };

  const { data: userProfile } = await authClient
    .from('users_view')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();

  if (!userProfile) return { asOwner: [], asBorrower: [] };

  const supabase = createServiceClient();

  const [{ data: asOwner }, { data: asBorrower }] = await Promise.all([
    supabase
      .from('asset_loans')
      .select('*, universal_assets(qr_code, brand, model, object_type, attributes)')
      .eq('owner_id', userProfile.id)
      .in('status', ['pending', 'active', 'overdue', 'escalated'])
      .order('created_at', { ascending: false }),
    supabase
      .from('asset_loans')
      .select('*, universal_assets(qr_code, brand, model, object_type, attributes)')
      .eq('borrower_id', userProfile.id)
      .in('status', ['pending', 'active', 'overdue'])
      .order('created_at', { ascending: false }),
  ]);

  return { asOwner: asOwner ?? [], asBorrower: asBorrower ?? [] };
}

export async function getLoanLedger(loanId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('loan_ledger')
    .select('*')
    .eq('loan_id', loanId)
    .order('charged_at', { ascending: false });
  return data ?? [];
}
