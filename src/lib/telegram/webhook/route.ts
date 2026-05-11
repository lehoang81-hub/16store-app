import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { handleAdminCommand } from '@/lib/telegram/admin-commands';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

interface TelegramUpdate {
  message?: {
    chat: { id: number; username?: string };
    text?: string;
    from: { id: number; username?: string; first_name?: string };
  };
}

/**
 * Webhook để Telegram gọi khi user nhắn cho bot.
 * Cần setup: gọi setWebhook với URL https://your-domain/api/telegram/webhook
 */
export async function POST(request: Request) {
  // Verify secret token
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
  if (WEBHOOK_SECRET && secretHeader !== WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update: TelegramUpdate = await request.json();
  const message = update.message;

  if (!message || !message.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text.trim();
  const username = message.from.username;

  // Lệnh /start
  if (text === '/start' || text.startsWith('/start ')) {
    await sendTelegram(chatId,
      '🏛 <b>Chào mừng đến 16Store</b>\n\n' +
      'Để nhận thông báo về pair ký gửi của bạn, hãy liên kết tài khoản:\n\n' +
      '1. Vào https://16store.com/settings\n' +
      '2. Nhấn "Liên kết Telegram"\n' +
      '3. Sao chép mã liên kết và gửi cho tôi với lệnh:\n' +
      '<code>/link MÃ_CỦA_BẠN</code>'
    );
    return NextResponse.json({ ok: true });
  }

  // Lệnh /link <token>
  if (text.startsWith('/link ')) {
    const token = text.slice(6).trim();
    if (!token) {
      await sendTelegram(chatId, '⚠ Cú pháp: <code>/link MÃ_LIÊN_KẾT</code>');
      return NextResponse.json({ ok: true });
    }

    const supabase = await createClient();

    // Tìm token còn hiệu lực
    const { data: tokenRow } = await supabase
      .from('telegram_link_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (!tokenRow) {
      await sendTelegram(chatId,
        '❌ Mã liên kết không hợp lệ hoặc đã hết hạn.\n\n' +
        'Tạo mã mới tại 16store.com/settings'
      );
      return NextResponse.json({ ok: true });
    }

    // Cập nhật user với chat_id
    await supabase.from('users').update({
      telegram_chat_id: chatId,
      telegram_username: username ?? null,
    }).eq('id', tokenRow.user_id);

    // Đánh dấu token đã dùng
    await supabase.from('telegram_link_tokens').update({
      used_at: new Date().toISOString(),
    }).eq('id', tokenRow.id);

    // Lấy tên user
    const { data: user } = await supabase
      .from('users')
      .select('handle, display_name')
      .eq('id', tokenRow.user_id)
      .single();

    await sendTelegram(chatId,
      `✓ <b>Liên kết thành công!</b>\n\n` +
      `Tài khoản: @${user?.handle}\n\n` +
      `Từ giờ bạn sẽ nhận thông báo khi pair của bạn:\n` +
      `• Được hub tiếp nhận\n` +
      `• Đã được verify\n` +
      `• Lên floor\n` +
      `• Được mua\n` +
      `• Tiền về tài khoản\n\n` +
      `Tắt thông báo bất cứ lúc nào tại 16store.com/settings`
    );

    return NextResponse.json({ ok: true });
  }

  // Lệnh /unlink
  if (text === '/unlink') {
    const supabase = await createClient();
    await supabase.from('users').update({
      telegram_chat_id: null,
      telegram_username: null,
    }).eq('telegram_chat_id', chatId);
    await sendTelegram(chatId, '✓ Đã hủy liên kết. Bạn sẽ không nhận thông báo nữa.');
    return NextResponse.json({ ok: true });
  }

  // Các lệnh admin (/stats, /pending, /revenue, /hub, /hubs, /admin)
  if (text.startsWith('/')) {
    const parts = text.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    // Tìm user theo chat_id
    const supabase = await createClient();
    const { data: user } = await supabase
      .from('users')
      .select('id, role')
      .eq('telegram_chat_id', chatId)
      .single();

    if (user) {
      const adminResponse = await handleAdminCommand(command, {
        chatId,
        userId: user.id,
        userRole: user.role,
        args,
      });

      if (adminResponse !== null) {
        await sendTelegram(chatId, adminResponse);
        return NextResponse.json({ ok: true });
      }
    }
  }

  // Lệnh /help hoặc text khác — fallback cho user thường
  await sendTelegram(chatId,
    '📋 <b>Các lệnh có sẵn:</b>\n\n' +
    '<code>/start</code> — Hướng dẫn liên kết tài khoản\n' +
    '<code>/link MÃ</code> — Liên kết với tài khoản 16Store\n' +
    '<code>/unlink</code> — Hủy liên kết\n' +
    '<code>/help</code> — Hiện hướng dẫn này\n\n' +
    '<i>Nếu bạn là hub admin hoặc super admin, gõ</i> <code>/admin</code> <i>để xem lệnh quản lý.</i>'
  );

  return NextResponse.json({ ok: true });
}

async function sendTelegram(chatId: number, text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('[telegram webhook]', err);
  }
}
