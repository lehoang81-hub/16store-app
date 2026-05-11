'use server';

import { createClient }        from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { revalidatePath }       from 'next/cache';
import { sendNotification }     from '@/lib/telegram/send';

// ── Types ─────────────────────────────────────────────────────

export type TransferType = 'gift' | 'sale' | 'trade' | 'inheritance';

export interface InitiateTransferInput {
  assetId:            string;
  recipientHandle:    string;
  transferType:       TransferType;
  priceVnd?:          number;
  note?:              string;
  handoverContext?:   string;
  handoverLocation?:  string;
  handoverImageUrls?: string[];
  lat?:               number;
  lng?:               number;
  accuracyM?:         number;
}

export interface TransferResult {
  success:     boolean;
  transferId?: string;
  error?:      string;
  toast:       { type: string; title: string; message: string };
}

// ── Helpers ───────────────────────────────────────────────────

async function getPlatformSettings(supabase: ReturnType<typeof createServiceClient>) {
  const { data } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['transfer_fees', 'anti_fraud']);

  const fees = data?.find(r => r.key === 'transfer_fees')?.value as Record<string, number> ?? {};
  const fraud = data?.find(r => r.key === 'anti_fraud')?.value as Record<string, number> ?? {};

  return {
    fees: {
      gift:            fees.gift            ?? 5,
      sale:            fees.sale            ?? 25,
      trade:           fees.trade           ?? 10,
      inheritance:     fees.inheritance     ?? 3,
      sale_bonus_both: fees.sale_bonus_both ?? 5,
    },
    fraud: {
      return_gift_days:        fraud.return_gift_days        ?? 7,
      max_gift_per_month:      fraud.max_gift_per_month      ?? 5,
      min_trust_to_receive:    fraud.min_trust_to_receive    ?? 20,
      repeat_pair_flag_count:  fraud.repeat_pair_flag_count  ?? 2,
    },
  };
}

// ── Lookup recipient (public) ─────────────────────────────────

export async function lookupTransferRecipient(handle: string): Promise<{
  success:  boolean;
  user?:    { id: string; handle: string; name: string; trust: number; totalAssets: number };
  error?:   string;
}> {
  const supabase = createServiceClient();
  const clean    = handle.replace('@', '').trim().toLowerCase();

  const { data: view } = await supabase
    .from('users_view')
    .select('id, handle')
    .eq('handle', clean)
    .single();

  if (!view) return { success: false, error: `@${clean} không tồn tại trên hệ thống` };

  const { data: full } = await supabase
    .from('users')
    .select('display_name, trust_score, reputation_score')
    .eq('user_id', view.id)
    .single();

  const { count: totalAssets } = await supabase
    .from('universal_assets')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', view.id);

  return {
    success: true,
    user: {
      id:          view.id,
      handle:      view.handle,
      name:        full?.display_name ?? view.handle,
      trust:       full?.trust_score ?? full?.reputation_score ?? 0,
      totalAssets: totalAssets ?? 0,
    },
  };
}

// ── Execute transfer ──────────────────────────────────────────

export async function executeTransfer(input: InitiateTransferInput): Promise<TransferResult> {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) return {
      success: false,
      toast:   { type: 'error', title: 'Chưa đăng nhập', message: 'Bạn cần đăng nhập để chuyển nhượng.' },
    };

    const supabase = createServiceClient();
    const { fees, fraud } = await getPlatformSettings(supabase);

    // ── Owner ─────────────────────────────────────────────────
    const { data: ownerView } = await supabase
      .from('users_view')
      .select('id, handle')
      .eq('auth_id', authUser.id)
      .single();

    if (!ownerView) return {
      success: false,
      toast: { type: 'error', title: 'Lỗi hồ sơ', message: 'Không tìm thấy thông tin người dùng.' },
    };

    const { data: ownerFull } = await supabase
      .from('users')
      .select('display_name, reward_points, trust_score')
      .eq('user_id', ownerView.id)
      .single();

    const ownerHlr = ownerFull?.reward_points ?? 0;

    // ── Asset validation ──────────────────────────────────────
    const { data: asset } = await supabase
      .from('universal_assets')
      .select('id, qr_code, brand, model, object_type, owner_id, transfer_status, is_lost, attributes, journey_score, journey_log')
      .eq('id', input.assetId)
      .single();

    if (!asset) return {
      success: false,
      toast: { type: 'error', title: 'Lỗi', message: 'Không tìm thấy vật phẩm.' },
    };

    if (asset.owner_id !== ownerView.id) return {
      success: false,
      toast: { type: 'error', title: 'Không có quyền', message: 'Bạn không sở hữu vật phẩm này.' },
    };

    if (asset.is_lost) return {
      success: false,
      toast: { type: 'error', title: 'Đang báo mất', message: 'Tắt báo mất trước khi chuyển nhượng.' },
    };

    // Check heirloom — chỉ được gift/loan/inherit
    const isHeirloom = (asset.attributes as any)?.heirloom === true;
    if (isHeirloom && (input.transferType === 'sale' || input.transferType === 'trade')) {
      return {
        success: false,
        toast: {
          type:    'error',
          title:   '👑 Vật phẩm Heirloom',
          message: 'Vật phẩm thừa kế không thể mua bán hoặc trao đổi. Chỉ có thể tặng, cho mượn hoặc thừa kế tiếp.',
        },
      };
    }

    // Check active loan
    const { data: activeLoan } = await supabase
      .from('asset_loans')
      .select('id')
      .eq('asset_id', input.assetId)
      .in('status', ['pending', 'active'])
      .maybeSingle();

    if (activeLoan) return {
      success: false,
      toast: { type: 'error', title: 'Đang cho mượn', message: 'Hoàn tất hợp đồng cho mượn trước khi chuyển nhượng.' },
    };

    // ── HLR fee check ─────────────────────────────────────────
    const feeMap: Record<TransferType, number> = {
      gift:        fees.gift,
      sale:        fees.sale,
      trade:       fees.trade,
      inheritance: fees.inheritance,
    };
    const hlrFee = feeMap[input.transferType];

    if (ownerHlr < hlrFee) {
      return {
        success: false,
        toast: {
          type:    'error',
          title:   'Không đủ HLR',
          message: `Cần ${hlrFee} HLR để ${input.transferType === 'gift' ? 'tặng' : input.transferType === 'sale' ? 'bán' : 'chuyển nhượng'}. Hiện có: ${ownerHlr} HLR.`,
        },
      };
    }

    // ── Recipient ─────────────────────────────────────────────
    const cleanHandle = input.recipientHandle.replace('@', '').trim().toLowerCase();
    const { data: recipientView } = await supabase
      .from('users_view')
      .select('id, handle')
      .eq('handle', cleanHandle)
      .single();

    if (!recipientView) return {
      success: false,
      toast: { type: 'error', title: 'Không tìm thấy', message: `@${cleanHandle} không tồn tại.` },
    };

    if (recipientView.id === ownerView.id) return {
      success: false,
      toast: { type: 'error', title: 'Không hợp lệ', message: 'Không thể chuyển nhượng cho chính mình.' },
    };

    const { data: recipientFull } = await supabase
      .from('users')
      .select('display_name, reward_points, trust_score')
      .eq('user_id', recipientView.id)
      .single();

    // ── Anti-fraud: Return gift detection ─────────────────────
    if (input.transferType === 'gift') {
      const cutoff = new Date(Date.now() - fraud.return_gift_days * 86400000).toISOString();
      const { data: reverseTransfer } = await supabase
        .from('ownership_history')
        .select('id')
        .eq('passport_id', input.assetId)
        .eq('owner_id', ownerView.id)        // Current owner previously received
        .eq('acquisition_type', 'gift')
        .gte('acquired_at', cutoff)
        .maybeSingle();

      if (reverseTransfer) {
        // Flag as return gift — still allow but mark
        console.warn('[transfer] Return gift detected:', ownerView.handle, '→', cleanHandle);
      }
    }

    // ── Anti-fraud: Max gifts per month ──────────────────────
    if (input.transferType === 'gift') {
      const monthStart = new Date(new Date().setDate(1)).toISOString();
      const { count: giftCount } = await supabase
        .from('ownership_history')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', ownerView.id)
        .eq('acquisition_type', 'gift')
        .gte('acquired_at', monthStart);

      if ((giftCount ?? 0) >= fraud.max_gift_per_month) {
        return {
          success: false,
          toast: {
            type:    'error',
            title:   'Giới hạn tặng',
            message: `Bạn đã tặng ${fraud.max_gift_per_month} vật phẩm trong tháng này. Liên hệ admin để được hỗ trợ.`,
          },
        };
      }
    }

    const now     = new Date();
    const timeStr = now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const attrs   = (asset.attributes as any) ?? {};
    const itemName = `${asset.brand ?? attrs.brand ?? ''} ${asset.model ?? attrs.model ?? ''}`.trim();

    const transferTypeLabel: Record<TransferType, string> = {
      gift:        '🎁 Tặng',
      sale:        '💰 Mua bán',
      trade:       '🔄 Trao đổi',
      inheritance: '👑 Thừa kế',
    };

    // ── Deduct HLR from owner ─────────────────────────────────
    await supabase
      .from('users')
      .update({ reward_points: ownerHlr - hlrFee })
      .eq('user_id', ownerView.id);

    // Sale bonus: +5 HLR cho cả 2 bên
    if (input.transferType === 'sale') {
      const recipientHlr = recipientFull?.reward_points ?? 0;
      const bonus = fees.sale_bonus_both;

      await supabase
        .from('users')
        .update({ reward_points: ownerHlr - hlrFee + bonus })
        .eq('user_id', ownerView.id);

      await supabase
        .from('users')
        .update({ reward_points: recipientHlr + bonus })
        .eq('user_id', recipientView.id);
    }

    // Inheritance: mark as heirloom
    if (input.transferType === 'inheritance') {
      const currentAttrs = (asset.attributes as any) ?? {};
      await supabase
        .from('universal_assets')
        .update({
          attributes: { ...currentAttrs, heirloom: true, inherited_at: now.toISOString(), inherited_from: ownerView.handle },
        })
        .eq('id', input.assetId);
    }

    // ── Close current ownership ───────────────────────────────
    await supabase
      .from('ownership_history')
      .update({ released_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('passport_id', input.assetId)
      .eq('owner_id', ownerView.id)
      .is('released_at', null);

    // ── Create new ownership ──────────────────────────────────
    const { data: newOwnership } = await supabase
      .from('ownership_history')
      .insert({
        passport_id:                 input.assetId,
        owner_id:                    recipientView.id,
        owner_handle_snapshot:       recipientView.handle,
        owner_display_name_snapshot: recipientFull?.display_name ?? recipientView.handle,
        acquired_at:                 now.toISOString(),
        acquisition_type:            input.transferType,
        transfer_type:               input.transferType,
        transfer_price_vnd:          input.priceVnd ?? null,
        transfer_note:               input.note ?? null,
        handover_context:            input.handoverContext ?? null,
        handover_location:           input.handoverLocation ?? null,
        handover_image_urls:         input.handoverImageUrls ?? [],
        location_lat:                input.lat ?? null,
        location_lng:                input.lng ?? null,
        notes:                       input.note ?? null,
      } as never)
      .select()
      .single();

    // ── Transfer ownership ────────────────────────────────────
    await supabase
      .from('universal_assets')
      .update({
        owner_id:        recipientView.id,
        transfer_status: 'locked',
        updated_at:      now.toISOString(),
      })
      .eq('id', input.assetId);

    // ── Journey Score +30 ─────────────────────────────────────
    const newScore = (asset.journey_score ?? 0) + 30;
    const newLog   = [...((asset.journey_log as any[]) ?? []), {
      reason:      'new_owner',
      points:      30,
      timestamp:   now.toISOString(),
      score_after: newScore,
      metadata:    {
        from_owner:    ownerView.handle,
        to_owner:      recipientView.handle,
        transfer_type: input.transferType,
        hlr_fee:       hlrFee,
        location:      input.handoverLocation,
      },
    }];

    await supabase
      .from('universal_assets')
      .update({ journey_score: newScore, journey_log: newLog })
      .eq('id', input.assetId);

    // ── System journal entry ──────────────────────────────────
    const journalContent = [
      `Chuyển từ @${ownerView.handle} → @${recipientView.handle}`,
      `Hình thức: ${transferTypeLabel[input.transferType]}`,
      input.priceVnd
        ? `Giá trị: ${new Intl.NumberFormat('vi-VN').format(input.priceVnd)} VNĐ`
        : null,
      input.handoverLocation ? `Địa điểm: ${input.handoverLocation}` : null,
      input.handoverContext  ? `Hoàn cảnh: ${input.handoverContext}`  : null,
      `Phí: ${hlrFee} HLR · Thời điểm: ${timeStr}`,
    ].filter(Boolean).join('\n');

    await supabase
      .from('passport_journal')
      .insert({
        passport_id:       input.assetId,
        owner_id:          recipientView.id,
        entry_type:        'other',
        title:             `${transferTypeLabel[input.transferType]} — Chuyển nhượng`,
        content:           journalContent,
        entry_date:        now.toISOString().split('T')[0],
        image_urls:        input.handoverImageUrls ?? [],
        is_system:         true,
        system_event_type: 'transferred',
        is_public:         true,
        visibility:        'public',
      } as never);

    // ── Trust score: Gift return flag ─────────────────────────
    // Nếu là return gift → KHÔNG cộng trust
    const isReturnGift = false; // TODO: detect từ reverse check above
    if (!isReturnGift && input.transferType !== 'sale') {
      // Cộng trust cho cả 2 bên giao dịch thành công
      await supabase.from('users').update({
        trust_score: (ownerFull?.trust_score ?? 0) + 2,
      }).eq('user_id', ownerView.id);

      await supabase.from('users').update({
        trust_score: (recipientFull?.trust_score ?? 0) + 2,
      }).eq('user_id', recipientView.id);
    }

    // ── Telegram notify cả 2 bên ─────────────────────────────
    const bonusNote = input.transferType === 'sale'
      ? `\n💎 Bonus: +${fees.sale_bonus_both} HLR cho cả hai bên`
      : '';

    await sendNotification({
      user_id: ownerView.id,
      event:   'post_verified' as any,
      payload: { type: 'transfer_sent', asset_id: input.assetId },
      message:
        `✅ <b>Chuyển nhượng thành công!</b>\n\n` +
        `📦 <b>${itemName}</b>\n` +
        `🔑 <code>${asset.qr_code}</code>\n` +
        `➡️ Người nhận: @${recipientView.handle}\n` +
        `📋 ${transferTypeLabel[input.transferType]}\n` +
        (input.priceVnd ? `💰 ${new Intl.NumberFormat('vi-VN').format(input.priceVnd)} VNĐ\n` : '') +
        `💸 Phí: -${hlrFee} HLR${bonusNote}\n` +
        `⏰ ${timeStr}\n` +
        `🔗 https://16store.app/p/${asset.qr_code}`,
    });

    await sendNotification({
      user_id: recipientView.id,
      event:   'post_verified' as any,
      payload: { type: 'transfer_received', asset_id: input.assetId },
      message:
        `🎁 <b>Bạn vừa nhận được vật phẩm mới!</b>\n\n` +
        `📦 <b>${itemName}</b>\n` +
        `🔑 <code>${asset.qr_code}</code>\n` +
        `⬅️ Từ: @${ownerView.handle}\n` +
        `📋 ${transferTypeLabel[input.transferType]}\n` +
        (input.note ? `💬 "${input.note}"\n` : '') +
        (input.transferType === 'sale' ? `💎 Bonus: +${fees.sale_bonus_both} HLR\n` : '') +
        `⏰ ${timeStr}\n` +
        (input.transferType === 'inheritance'
          ? `\n👑 Đây là vật phẩm Heirloom — không thể bán hoặc trao đổi.\n`
          : '') +
        `🔗 https://16store.app/p/${asset.qr_code}`,
    });

    revalidatePath(`/passport/${asset.qr_code}`);

    return {
      success:    true,
      transferId: newOwnership?.id,
      toast: {
        type:    'success',
        title:   '✅ Chuyển nhượng thành công!',
        message: `${itemName} đã thuộc về @${recipientView.handle}. Phí: ${hlrFee} HLR.${input.transferType === 'sale' ? ` Bonus +${fees.sale_bonus_both} HLR cho cả hai.` : ''}`,
      },
    };

  } catch (err) {
    console.error('[executeTransfer]', err);
    return {
      success: false,
      error:   String(err),
      toast:   { type: 'error', title: 'Lỗi hệ thống', message: String(err) },
    };
  }
}
