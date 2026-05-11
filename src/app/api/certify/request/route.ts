import { NextRequest, NextResponse } from 'next/server';
import { createClient }        from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_CHAT   = process.env.TELEGRAM_ADMIN_CHAT_ID ?? '8473231197';
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://16store.app';

// ── Helper: gửi Telegram message với inline keyboard ──────────
async function sendTelegramMessage(text: string, replyMarkup: object) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      chat_id:      ADMIN_CHAT,
      text,
      parse_mode:   'HTML',
      reply_markup: replyMarkup,
    }),
  });
  const json = await res.json();
  return json?.result?.message_id as number | undefined;
}

// ── POST /api/certify/request ─────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { passportId, notes } = await req.json();
    if (!passportId) {
      return NextResponse.json({ error: 'Thiếu passportId' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Lấy user profile
    const { data: profile } = await supabase
      .from('users_view')
      .select('id, handle, display_name')
      .eq('auth_id', authUser.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Không tìm thấy hồ sơ' }, { status: 404 });
    }

    // Lấy passport info
    const { data: passport } = await supabase
      .from('universal_assets')
      .select('id, qr_code, brand, model, colorway, identity_status, owner_id')
      .eq('id', passportId)
      .single();

    if (!passport) {
      return NextResponse.json({ error: 'Không tìm thấy vật phẩm' }, { status: 404 });
    }

    // Chỉ chủ nhân mới request được
    if (passport.owner_id !== profile.id) {
      return NextResponse.json({ error: 'Chỉ chủ nhân mới có thể yêu cầu chứng nhận' }, { status: 403 });
    }

    // Chỉ temp_claimed hoặc ai_verified mới request được
    if (passport.identity_status === 'certified') {
      return NextResponse.json({ error: 'Vật phẩm đã được chứng nhận' }, { status: 400 });
    }

    // Check pending request đã tồn tại chưa
    const { data: existing } = await supabase
      .from('certification_requests')
      .select('id, status')
      .eq('passport_id', passportId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Đã có yêu cầu đang chờ xử lý' }, { status: 409 });
    }

    // Tạo request
    const { data: request, error: insertError } = await supabase
      .from('certification_requests')
      .insert({
        passport_id:  passportId,
        requester_id: profile.id,
        status:       'pending',
        notes:        notes ?? null,
      })
      .select('id')
      .single();

    if (insertError || !request) {
      console.error('[certify/request] insert error:', insertError);
      return NextResponse.json({ error: 'Không thể tạo yêu cầu' }, { status: 500 });
    }

    // Build Telegram message
    const itemName   = [passport.brand, passport.model, passport.colorway ? `"${passport.colorway}"` : ''].filter(Boolean).join(' ');
    const ownerLabel = profile.display_name ?? `@${profile.handle}`;
    const passportUrl = `${APP_URL}/passport/${passport.qr_code}`;

    const msgText = [
      `✦ <b>YÊU CẦU CHỨNG NHẬN MỚI</b>`,
      ``,
      `📦 <b>Vật phẩm:</b> ${itemName}`,
      `👤 <b>Chủ nhân:</b> ${ownerLabel} (@${profile.handle})`,
      `🔗 <b>Passport:</b> <a href="${passportUrl}">${passport.qr_code}</a>`,
      notes ? `📝 <b>Ghi chú:</b> ${notes}` : '',
      ``,
      `⏰ ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
    ].filter(l => l !== undefined).join('\n');

    // Inline keyboard — approve / reject
    const replyMarkup = {
      inline_keyboard: [[
        {
          text:          '✓ APPROVE',
          callback_data: `certify:approve:${request.id}`,
        },
        {
          text:          '✗ REJECT',
          callback_data: `certify:reject:${request.id}`,
        },
      ]],
    };

    const msgId = await sendTelegramMessage(msgText, replyMarkup);

    // Lưu telegram_msg_id để edit sau
    if (msgId) {
      await supabase
        .from('certification_requests')
        .update({ telegram_msg_id: msgId })
        .eq('id', request.id);
    }

    return NextResponse.json({ success: true, requestId: request.id });

  } catch (err) {
    console.error('[certify/request]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── GET — check trạng thái request hiện tại ───────────────────
export async function GET(req: NextRequest) {
  try {
    const passportId = req.nextUrl.searchParams.get('passportId');
    if (!passportId) {
      return NextResponse.json({ error: 'Missing passportId' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data } = await supabase
      .from('certification_requests')
      .select('id, status, requested_at, reviewed_at, reject_reason')
      .eq('passport_id', passportId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ request: data ?? null });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
