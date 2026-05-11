import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN!;
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://16store.app';
const ADMIN_CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID ?? '8473231197';

// ── Telegram helpers ──────────────────────────────────────────

async function answerCallback(callbackQueryId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

async function editMessage(chatId: string | number, messageId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      chat_id:    chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
    }),
  });
}

async function sendMessage(chatId: string | number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

// ── Lấy reject reason từ admin (conversation state) ───────────
// Đơn giản: dùng inline keyboard với các lý do preset + "Khác"
async function askRejectReason(chatId: string | number, requestId: string, messageId: number) {
  const reasons = [
    'Ảnh không đủ rõ nét',
    'Thông tin không khớp',
    'Hàng giả / không chính hãng',
    'Cần mang đến Hub trực tiếp',
    'Thông tin thiếu chính xác',
  ];

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      chat_id:    chatId,
      text:       '📝 <b>Chọn lý do từ chối:</b>',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          ...reasons.map(r => [{
            text:          r,
            callback_data: `certify:reason:${requestId}:${messageId}:${r.slice(0, 30)}`,
          }]),
          [{
            text:          '✎ Nhập lý do khác...',
            callback_data: `certify:reason:${requestId}:${messageId}:__custom__`,
          }],
        ],
      },
    }),
  });
}

// ── POST /api/certify/callback — Telegram webhook ─────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const callbackQuery = body?.callback_query;
    if (!callbackQuery) {
      return NextResponse.json({ ok: true }); // ignore non-callback updates
    }

    const { id: callbackId, data: callbackData, message, from } = callbackQuery;
    if (!callbackData?.startsWith('certify:')) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createServiceClient();
    const parts    = callbackData.split(':');
    const action   = parts[1]; // approve | reject | reason

    // ── APPROVE ───────────────────────────────────────────────
    if (action === 'approve') {
      const requestId = parts[2];

      // Lấy request + passport info
      const { data: request } = await supabase
        .from('certification_requests')
        .select('*, universal_assets(id, qr_code, brand, model, owner_id)')
        .eq('id', requestId)
        .single();

      if (!request || request.status !== 'pending') {
        await answerCallback(callbackId, '⚠️ Request không hợp lệ hoặc đã xử lý');
        return NextResponse.json({ ok: true });
      }

      const passport = (request as any).universal_assets;

      // Update certification_requests
      await supabase
        .from('certification_requests')
        .update({
          status:      'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: null, // admin không có user_id trong hệ thống
        })
        .eq('id', requestId);

      // Update passport identity_status
      await supabase
        .from('universal_assets')
        .update({ identity_status: 'certified' })
        .eq('id', passport.id);

      // Edit original message
      if (message?.message_id) {
        await editMessage(
          message.chat.id,
          message.message_id,
          [
            `✦ <b>YÊU CẦU CHỨNG NHẬN</b> — <b>ĐÃ APPROVE</b> ✓`,
            ``,
            `📦 ${passport.brand} ${passport.model}`,
            `🔗 ${APP_URL}/passport/${passport.qr_code}`,
            ``,
            `✅ Đã cấp chứng nhận bởi @${from?.username ?? 'admin'}`,
            `⏰ ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
          ].join('\n')
        );
      }

      // Notify chủ nhân qua Telegram nếu có telegram_chat_id
      const { data: owner } = await supabase
        .from('users')
        .select('telegram_chat_id, display_name')
        .eq('user_id', passport.owner_id)
        .maybeSingle();

      if (owner?.telegram_chat_id) {
        await sendMessage(
          owner.telegram_chat_id,
          [
            `✦ <b>Chúc mừng!</b>`,
            ``,
            `Vật phẩm <b>${passport.brand} ${passport.model}</b> của bạn`,
            `đã được <b>16Store chứng nhận</b> chính thức.`,
            ``,
            `🏆 Passport đã nâng cấp lên <b>Tier 3 — Certified</b>`,
            `🔗 <a href="${APP_URL}/passport/${passport.qr_code}">Xem passport</a>`,
          ].join('\n')
        );
      }

      await answerCallback(callbackId, '✅ Đã approve thành công!');
      return NextResponse.json({ ok: true });
    }

    // ── REJECT — hiện menu chọn lý do ─────────────────────────
    if (action === 'reject') {
      const requestId = parts[2];

      // Check request còn pending không
      const { data: request } = await supabase
        .from('certification_requests')
        .select('id, status')
        .eq('id', requestId)
        .single();

      if (!request || request.status !== 'pending') {
        await answerCallback(callbackId, '⚠️ Request không hợp lệ hoặc đã xử lý');
        return NextResponse.json({ ok: true });
      }

      await answerCallback(callbackId, 'Chọn lý do từ chối...');
      await askRejectReason(message.chat.id, requestId, message.message_id);
      return NextResponse.json({ ok: true });
    }

    // ── REASON — admin chọn lý do từ chối ────────────────────
    if (action === 'reason') {
      const requestId  = parts[2];
      const origMsgId  = parseInt(parts[3]);
      const reasonRaw  = parts.slice(4).join(':');

      if (reasonRaw === '__custom__') {
        // Hướng dẫn admin reply text
        await answerCallback(callbackId, 'Nhập lý do...');
        await sendMessage(
          message.chat.id,
          `📝 Reply tin nhắn này với lý do từ chối:\n<code>reject:${requestId}:${origMsgId}:Lý do của bạn...</code>`,
        );
        return NextResponse.json({ ok: true });
      }

      // Xử lý reject với lý do đã chọn
      const { data: request } = await supabase
        .from('certification_requests')
        .select('*, universal_assets(id, qr_code, brand, model, owner_id)')
        .eq('id', requestId)
        .single();

      if (!request || request.status !== 'pending') {
        await answerCallback(callbackId, '⚠️ Đã xử lý rồi');
        return NextResponse.json({ ok: true });
      }

      const passport = (request as any).universal_assets;

      // Update request
      await supabase
        .from('certification_requests')
        .update({
          status:        'rejected',
          reviewed_at:   new Date().toISOString(),
          reject_reason: reasonRaw,
        })
        .eq('id', requestId);

      // Edit original message
      if (origMsgId) {
        await editMessage(
          message.chat.id,
          origMsgId,
          [
            `✦ <b>YÊU CẦU CHỨNG NHẬN</b> — <b>ĐÃ TỪ CHỐI</b> ✗`,
            ``,
            `📦 ${passport.brand} ${passport.model}`,
            `❌ <b>Lý do:</b> ${reasonRaw}`,
            ``,
            `👤 Từ chối bởi @${from?.username ?? 'admin'}`,
            `⏰ ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
          ].join('\n')
        );
      }

      // Notify chủ nhân
      const { data: owner } = await supabase
        .from('users')
        .select('telegram_chat_id')
        .eq('user_id', passport.owner_id)
        .maybeSingle();

      if (owner?.telegram_chat_id) {
        await sendMessage(
          owner.telegram_chat_id,
          [
            `⚠️ <b>Yêu cầu chứng nhận chưa được duyệt</b>`,
            ``,
            `Vật phẩm: <b>${passport.brand} ${passport.model}</b>`,
            `❌ <b>Lý do:</b> ${reasonRaw}`,
            ``,
            `Bạn có thể chỉnh sửa thông tin và gửi lại yêu cầu.`,
            `🔗 <a href="${APP_URL}/passport/${passport.qr_code}">Xem passport</a>`,
          ].join('\n')
        );
      }

      await answerCallback(callbackId, '✗ Đã từ chối');
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error('[certify/callback]', err);
    return NextResponse.json({ ok: true }); // Telegram cần 200 luôn
  }
}
