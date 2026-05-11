import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendNotification } from '@/lib/telegram/send';

// ── Config (platform_settings sau này) ───────────────────────
const LOST_HLR_COST        = 10;  // HLR để báo mất (KHÔNG hoàn lại)
const LOST_COOLDOWN_DAYS   = 15;  // Cooldown giữa 2 lần báo mất
const MAX_LOST_PER_MONTH   = 2;   // Max báo mất / item / tháng

export async function POST(req: NextRequest) {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

    const { passport_id, message } = await req.json();
    if (!passport_id) return NextResponse.json({ error: 'Thiếu passport_id' }, { status: 400 });

    const supabase = createServiceClient();

    // Step 1: Get user_id từ users_view
    const { data: ownerView, error: viewError } = await supabase
      .from('users_view')
      .select('id, handle, display_name')
      .eq('auth_id', authUser.id)
      .single();

    if (!ownerView) return NextResponse.json({
      error: `Không tìm thấy hồ sơ (${viewError?.message})`,
    }, { status: 404 });

    // Step 2: Get reward_points từ users table
    const { data: ownerFull } = await supabase
      .from('users')
      .select('reward_points')
      .eq('user_id', ownerView.id)
      .single();

    const owner = {
      ...ownerView,
      reward_points: ownerFull?.reward_points ?? 0,
    };

    // Get asset
    const { data: asset } = await supabase
      .from('universal_assets')
      .select('id, qr_code, brand, model, object_type, owner_id, is_lost, attributes')
      .eq('id', passport_id)
      .single();

    if (!asset) return NextResponse.json({ error: 'Không tìm thấy vật phẩm' }, { status: 404 });
    if (asset.owner_id !== owner.id) return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
    if (asset.is_lost) return NextResponse.json({ error: 'Vật phẩm đã đang báo mất' }, { status: 400 });

    // ── Anti-fraud: Cooldown check ───────────────────────────
    const cooldownDate = new Date(Date.now() - LOST_COOLDOWN_DAYS * 86400000).toISOString();
    const { count: recentLostCount } = await supabase
      .from('lost_recovery_log')
      .select('*', { count: 'exact', head: true })
      .eq('asset_id', passport_id)
      .gte('created_at', cooldownDate);

    if ((recentLostCount ?? 0) >= MAX_LOST_PER_MONTH) {
      return NextResponse.json({
        error: `Vật phẩm này đã báo mất ${MAX_LOST_PER_MONTH} lần trong ${LOST_COOLDOWN_DAYS} ngày qua. Vui lòng liên hệ admin.`,
      }, { status: 429 });
    }

    // ── Check HLR balance ────────────────────────────────────
    const balance = owner.reward_points ?? 0;
    if (balance < LOST_HLR_COST) {
      return NextResponse.json({
        error: `Không đủ HLR. Cần ${LOST_HLR_COST} HLR để báo mất. Hiện có: ${balance} HLR.`,
      }, { status: 402 });
    }

    const now = new Date();
    const attrs = (asset.attributes as any) ?? {};
    const itemName = `${asset.brand ?? attrs.brand ?? ''} ${asset.model ?? attrs.model ?? ''}`.trim();

    // ── Atomic operations ────────────────────────────────────

    // 1. Trừ HLR (KHÔNG hoàn lại)
    await supabase
      .from('users')
      .update({ reward_points: balance - LOST_HLR_COST })
      .eq('user_id', owner.id);

    // 2. Mark asset as lost
    await supabase
      .from('universal_assets')
      .update({
        is_lost:          true,
        transfer_status:  'locked',
        updated_at:       now.toISOString(),
      })
      .eq('id', passport_id);

    // 3. Log vào lost_recovery_log
    await supabase
      .from('lost_recovery_log')
      .insert({
        asset_id:        passport_id,
        owner_id:        owner.id,
        status:          'active',
        lost_message:    message ?? null,
        hlr_cost:        LOST_HLR_COST,
        created_at:      now.toISOString(),
        updated_at:      now.toISOString(),
      } as never);

    // ── 4. Auto journal entry ─────────────────────────────────
    const timeStr = now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    await supabase
      .from('passport_journal')
      .insert({
        passport_id:       passport_id,
        owner_id:          owner.id,
        entry_type:        'other',
        title:             '🚨 Báo mất vật phẩm',
        content:           message
          ? `Vật phẩm được báo mất lúc ${timeStr}.\nTin nhắn cho người tìm: "${message}"`
          : `Vật phẩm được báo mất lúc ${timeStr}.`,
        entry_date:        now.toISOString().split('T')[0],
        image_urls:        [],
        is_system:         true,
        system_event_type: 'lost_reported',
        is_public:         true,
      } as never);

    // ── 5. Telegram notify owner ─────────────────────────────
    await sendNotification({
      user_id: owner.id,
      event:   'post_submitted' as any,
      payload: { type: 'lost_activated', asset_id: passport_id },
      message:
        `🚨 <b>Báo mất đã được kích hoạt!</b>\n\n` +
        `📦 Vật phẩm: <b>${itemName}</b>\n` +
        `🔑 Mã QR: <code>${asset.qr_code}</code>\n` +
        `⏰ Thời gian: ${timeStr}\n` +
        `💰 Đã trừ: ${LOST_HLR_COST} HLR (không hoàn lại)\n\n` +
        `<b>Bạn sẽ nhận thông báo ngay khi:</b>\n` +
        `• Có người scan QR vật phẩm\n` +
        `• Người tìm thấy chủ động báo vị trí\n\n` +
        (message ? `💬 Tin nhắn cho người tìm: "<i>${message}</i>"\n\n` : '') +
        `🔗 https://16store.app/p/${asset.qr_code}`,
    });

    return NextResponse.json({
      success: true,
      hlrDeducted: LOST_HLR_COST,
      activatedAt: timeStr,
    });

  } catch (err) {
    console.error('[POST /api/passports/lost]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── Finder gửi vị trí / message ──────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const {
      passport_id, finder_message,
      lat, lng, city,
      finder_email,  // Email nếu chưa login
    } = await req.json();

    if (!passport_id) return NextResponse.json({ error: 'Thiếu passport_id' }, { status: 400 });

    const supabase = createServiceClient();

    // Get auth (optional - finder có thể chưa login)
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    let finderUserId: string | null = null;
    let finderHandle = 'Ẩn danh';
    let finderEmail  = finder_email ?? null;

    if (authUser) {
      const { data: finderProfile } = await supabase
        .from('users_view')
        .select('id, handle, display_name')
        .eq('auth_id', authUser.id)
        .single();
      if (finderProfile) {
        finderUserId = finderProfile.id;
        finderHandle = `@${finderProfile.handle}`;
        finderEmail  = authUser.email ?? finderEmail;
      }
    }

    // Get asset + owner
    const { data: asset } = await supabase
      .from('universal_assets')
      .select('id, qr_code, brand, model, owner_id, is_lost, attributes')
      .eq('id', passport_id)
      .single();

    if (!asset?.is_lost) {
      return NextResponse.json({ error: 'Vật phẩm không trong trạng thái báo mất' }, { status: 400 });
    }

    const attrs    = (asset.attributes as any) ?? {};
    const itemName = `${asset.brand ?? attrs.brand ?? ''} ${asset.model ?? attrs.model ?? ''}`.trim();
    const now      = new Date();
    const timeStr  = now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    // Log finder contact vào lost_recovery_log
    await supabase
      .from('lost_recovery_log')
      .update({
        finder_user_id:  finderUserId,
        finder_message:  finder_message ?? null,
        finder_email:    finderEmail,
        finder_lat:      lat ?? null,
        finder_lng:      lng ?? null,
        finder_city:     city ?? null,
        finder_reported_at: now.toISOString(),
        updated_at:      now.toISOString(),
      } as never)
      .eq('asset_id', passport_id)
      .eq('status', 'active');

    // Telegram notify owner
    const locationStr = lat
      ? `📍 GPS: ${Number(lat).toFixed(4)}°N, ${Number(lng).toFixed(4)}°E${city ? ` (${city})` : ''}`
      : city
      ? `📍 Khu vực: ${city}`
      : '📍 Vị trí: Không xác định';

    await sendNotification({
      user_id: asset.owner_id,
      event:   'post_verified' as any,
      payload: { type: 'finder_report', asset_id: passport_id, finder_email: finderEmail },
      message:
        `💬 <b>Có người báo tìm thấy ${itemName}!</b>\n\n` +
        `👤 Người báo: <b>${finderHandle}</b>\n` +
        (finderEmail ? `📧 Email: <code>${finderEmail}</code>\n` : '') +
        `⏰ Thời gian: ${timeStr}\n` +
        `${locationStr}\n\n` +
        (finder_message ? `💬 Họ nhắn: "<i>${finder_message}</i>"\n\n` : '') +
        `🔗 Xem hộ chiếu: https://16store.app/p/${asset.qr_code}`,
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[PUT /api/passports/lost]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
