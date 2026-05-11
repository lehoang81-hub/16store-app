import { createServiceClient } from '@/lib/supabase/service';

// Helper: thực hiện split payment khi order confirmed
// Gọi từ admin confirm route
export async function processSplitPayment(orderId: string, confirmedBy: string) {
  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (!order) throw new Error('Order not found');

  // Đọc platform fee từ settings
  const { data: feeSetting } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'listing_fee_pct')
    .maybeSingle();

  const feePct         = parseFloat(feeSetting?.value ?? '7') / 100;
  const platformFeeVnd = Math.floor(order.amount_vnd * feePct);
  const sellerAmountVnd = order.amount_vnd - platformFeeVnd;

  // Lấy balance hiện tại của seller
  const { data: seller } = await supabase
    .from('users')
    .select('wallet_balance_vnd')
    .eq('id', order.seller_id)
    .single();

  const currentBalance = seller?.wallet_balance_vnd ?? 0;
  const newBalance     = currentBalance + sellerAmountVnd;

  // Update wallet seller
  await supabase
    .from('users')
    .update({ wallet_balance_vnd: newBalance })
    .eq('id', order.seller_id);

  // Ghi transaction: seller nhận tiền
  await supabase.from('wallet_transactions').insert({
    user_id:          order.seller_id,
    type:             'sale_credit',
    amount_vnd:       sellerAmountVnd,
    balance_after_vnd: newBalance,
    order_id:         orderId,
    note:             `Bán LOT ${order.lot_id} · Phí nền tảng ${feePct * 100}%`,
  });

  // Ghi transaction: platform fee
  await supabase.from('wallet_transactions').insert({
    user_id:           confirmedBy,
    type:              'platform_fee',
    amount_vnd:        platformFeeVnd,
    balance_after_vnd: 0,
    order_id:          orderId,
    note:              `Platform fee LOT ${order.lot_id}`,
  });

  // Journey Score: +10 khi đổi chủ
  const { data: passport } = await supabase
    .from('shoe_passports')
    .select('id')
    .eq('id', order.passport_id)
    .single();

  if (passport) {
    await supabase.rpc('add_journey_score', {
      p_passport_id: passport.id,
      p_points:      10,
      p_reason:      'new_owner',
      p_metadata:    { order_id: orderId, lot_id: order.lot_id },
    }).catch(() => null);
  }

  return { sellerAmountVnd, platformFeeVnd };
}
