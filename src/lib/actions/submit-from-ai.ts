'use server';

import { createClient } from '@/lib/supabase/server';
import { sendNotification } from '@/lib/telegram/send';
import { generateVietQR, generateOrderCode } from '@/lib/payment/vietqr';
import { calculateListingFee } from '@/lib/pricing/calculate-fee';
import type { PostCondition } from '@/types/database';
import type { ExtractedSneaker } from '@/lib/ai/extract-sneaker';
import { revalidatePath } from 'next/cache';

export interface SubmitFromAiInput {
  // Thông tin user đã confirm/sửa từ AI
  brand: string;
  model: string;
  colorway: string;
  size_us: number;
  condition: PostCondition;
  release_year: number | null;
  asking_price_vnd: number;
  hub_id: string;
  image_paths: string[];
  // AI + polished content
  ai_extracted: ExtractedSneaker;
  polished_description: string;  // user có thể đã sửa
  seller_caption: string;         // caption gốc
}

export interface SubmitFromAiResult {
  success: boolean;
  post_id?: string;
  lot_id?: string;
  payment_id?: string;
  order_code?: string;
  vietqr_url?: string;
  fee_amount_vnd?: number;
  campaign_name?: string | null;
  error?: string;
}

export async function submitPairFromAi(input: SubmitFromAiInput): Promise<SubmitFromAiResult> {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return { success: false, error: 'Bạn cần đăng nhập' };

  // Validate
  if (!input.brand || !input.model || !input.size_us || !input.asking_price_vnd) {
    return { success: false, error: 'Thiếu thông tin bắt buộc' };
  }
  if (input.image_paths.length === 0) {
    return { success: false, error: 'Cần ít nhất 1 ảnh' };
  }

  // Sinh lot_id
  const { data: lotIdResult, error: lotIdError } = await supabase
    .rpc('generate_lot_id', { p_brand: input.brand, p_release_year: input.release_year });
  if (lotIdError || !lotIdResult) {
    return { success: false, error: 'Không tạo được mã lot: ' + (lotIdError?.message ?? 'unknown') };
  }
  const lot_id = lotIdResult as string;

  // Get image URLs
  const image_urls = input.image_paths.map((path) => {
    const { data } = supabase.storage.from('sneaker-photos').getPublicUrl(path);
    return data.publicUrl;
  });

  // Insert post với AI data
  const { data: post, error: insertError } = await supabase
    .from('posts')
    .insert({
      lot_id,
      seller_id: authUser.id,
      hub_id: input.hub_id,
      brand: input.brand,
      model: input.model,
      colorway: input.colorway || null,
      size_us: input.size_us,
      condition: input.condition,
      release_year: input.release_year,
      asking_price_vnd: input.asking_price_vnd,
      reserve_price_vnd: Math.round(input.asking_price_vnd * 0.95),
      market_avg_vnd: input.ai_extracted.estimated_price_vnd ?? input.asking_price_vnd,
      status: 'pending_payment',
      image_urls,
      cover_image_url: image_urls[0],
      ai_extracted: input.ai_extracted,
      ai_confidence: input.ai_extracted.confidence,
      ai_risk_flags: input.ai_extracted.risk_flags,
      polished_description: input.polished_description,
      seller_caption: input.seller_caption,
      verify_stitching: false,
      verify_sole: false,
      verify_materials: false,
      verify_box: false,
      verified_at: null,
      verified_by: null,
      view_count: 0,
      is_featured: false,
      listed_at: null,
      sold_at: null,
    } as never)
    .select()
    .single();

  if (insertError || !post) {
    return { success: false, error: 'Không lưu được pair: ' + (insertError?.message ?? 'unknown') };
  }

  // Tính phí bằng TypeScript function (không dùng RPC vì parser Supabase không chấp nhận plpgsql function phức tạp)
  const feeResult = await calculateListingFee({
    brand: input.brand,
    asking_price_vnd: input.asking_price_vnd,
    user_id: authUser.id,
  });

  const feeAmount = feeResult.fee_amount_vnd;
  const feeRate = feeResult.fee_rate;
  const campaignName = feeResult.campaign_name;

  // Sinh VietQR cho phí ký gửi
  const orderCode = generateOrderCode();
  const vietqrUrl = generateVietQR({
    bankBin: process.env.BANK_BIN ?? '970422',
    accountNumber: process.env.BANK_ACCOUNT ?? '0123456789',
    accountName: process.env.BANK_NAME ?? 'NGUYEN VAN A',
    amount: feeAmount,
    description: orderCode,
  });

  // Insert payment record (status='pending')
  const { data: payment, error: payError } = await supabase
    .from('payments')
    .insert({
      post_id: (post as { id: string }).id,
      buyer_id: authUser.id, // ở phase 3 buyer = seller (trả phí ký gửi)
      seller_id: authUser.id,
      gross_amount_vnd: feeAmount,
      platform_fee_vnd: feeAmount,
      seller_payout_vnd: 0,
      fee_rate: feeRate,
      status: 'pending',
      payment_method: 'vietqr',
      held_at: null,
      cleared_at: null,
      payout_reference: null,
      order_code: orderCode,
      vietqr_url: vietqrUrl,
      payos_ref: null,
      raw_webhook_payload: null,
    } as never)
    .select()
    .single();

  if (payError) {
    console.error('[submitPairFromAi] payment insert failed:', payError);
  }

  // Telegram notification
  await sendNotification({
    user_id: authUser.id,
    event: 'post_submitted',
    payload: { lot_id, brand: input.brand, model: input.model, fee: feeAmount },
    message:
      `✓ <b>Pair của bạn đã được tiếp nhận</b>\n\n` +
      `Mã lot: <code>${lot_id}</code>\n` +
      `${input.brand} ${input.model}\n` +
      `Size ${input.size_us} US\n\n` +
      `💰 Phí ký gửi: <b>${feeAmount.toLocaleString('vi-VN')}đ</b>` +
      (campaignName ? `\n🎁 Áp dụng: <i>${campaignName}</i>` : '') +
      `\n\nQuét VietQR trong app để hoàn tất, pair sẽ tự lên floor sau khi trả phí.`,
  });

  revalidatePath('/');
  revalidatePath('/dashboard');

  return {
    success: true,
    post_id: (post as { id: string }).id,
    lot_id,
    payment_id: (payment as { id: string } | null)?.id,
    order_code: orderCode,
    vietqr_url: vietqrUrl,
    fee_amount_vnd: feeAmount,
    campaign_name: campaignName,
  };
}

/**
 * MOCK: giả lập user đã trả tiền VietQR.
 * Trong production sẽ là PayOS webhook gọi vào.
 * Sẽ:
 * 1. Update payment.status = 'cleared'
 * 2. Auto-approve post nếu AI confidence ≥ 0.85 và no risk flags
 * 3. Cộng reputation
 * 4. Telegram notification
 */
export async function mockMarkPaymentPaid(orderCode: string): Promise<{ success: boolean; auto_approved?: boolean; error?: string }> {
  if (process.env.USE_PAYMENT_MOCK !== 'true') {
    return { success: false, error: 'Mock đã tắt. Set USE_PAYMENT_MOCK=true trong .env.local' };
  }

  const supabase = await createClient();

  // Lấy payment + post
  const { data: payment } = await supabase
    .from('payments')
    .select('*, post:posts(*)')
    .eq('order_code', orderCode)
    .single();

  if (!payment) return { success: false, error: 'Không tìm thấy payment' };
  if ((payment as { status: string }).status === 'cleared') {
    return { success: true, auto_approved: false };
  }

  const post = (payment as { post: { id: string; ai_confidence: number; ai_risk_flags: string[] | null; seller_id: string; lot_id: string; brand: string; model: string } }).post;

  // Auto-approve logic
  const autoApprove =
    post.ai_confidence >= 0.85 &&
    (!post.ai_risk_flags || post.ai_risk_flags.length === 0);

  const newStatus = autoApprove ? 'live' : 'pending_verify';

  // Update payment
  await supabase.from('payments').update({
    status: 'cleared',
    held_at: new Date().toISOString(),
    cleared_at: new Date().toISOString(),
  } as never).eq('id', (payment as { id: string }).id);

  // Update post
  const updateFields: Record<string, unknown> = { status: newStatus };
  if (autoApprove) {
    updateFields.listed_at = new Date().toISOString();
  }
  await supabase.from('posts').update(updateFields).eq('id', post.id);

  // Reputation log
  if (autoApprove) {
    await supabase.rpc('add_reputation', {
      p_user_id: post.seller_id,
      p_delta: 5,
      p_reason: 'post_auto_approved',
      p_post_id: post.id,
      p_payment_id: (payment as { id: string }).id,
      p_notes: 'Auto-approved by AI confidence',
    });
  }

  // Telegram
  await sendNotification({
    user_id: post.seller_id,
    event: autoApprove ? 'post_listed' : 'post_received_by_hub',
    payload: { lot_id: post.lot_id, auto: autoApprove },
    message: autoApprove
      ? `🎉 <b>Pair của bạn đã LIVE trên floor!</b>\n\n` +
        `Mã lot: <code>${post.lot_id}</code>\n` +
        `${post.brand} ${post.model}\n\n` +
        `+5 điểm uy tín. Auto-approved bởi AI.`
      : `✅ <b>Đã nhận thanh toán</b>\n\n` +
        `Mã lot: <code>${post.lot_id}</code>\n` +
        `Pair đang chờ verify thủ công tại hub (do AI confidence chưa cao đủ hoặc có cảnh báo).`,
  });

  revalidatePath('/');
  revalidatePath('/dashboard');

  return { success: true, auto_approved: autoApprove };
}
