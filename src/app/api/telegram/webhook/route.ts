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

const BADGE_CONFIG: Record<string, { icon: string; label: string; nextScore?: number; next?: string }> = {
  bronze:   { icon: '🥉', label: 'Bronze',   nextScore: 500,  next: 'Silver'   },
  silver:   { icon: '🥈', label: 'Silver',   nextScore: 1000, next: 'Gold'     },
  gold:     { icon: '🥇', label: 'Gold',     nextScore: 2500, next: 'Platinum' },
  platinum: { icon: '💎', label: 'Platinum' },
}

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

    await supabase.from('users').update({
      telegram_chat_id: chatId,
      telegram_username: username ?? null,
    }).eq('id', tokenRow.user_id);

    await supabase.from('telegram_link_tokens').update({
      used_at: new Date().toISOString(),
    }).eq('id', tokenRow.id);

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

  // ── Lệnh /score ──────────────────────────────────────────────
  if (text === '/score') {
    const supabase = await createClient();
    const { data: user } = await supabase
      .from('users')
      .select('handle, reputation_score, badge, total_pairs_sold, total_volume_vnd')
      .eq('telegram_chat_id', chatId)
      .single();

    if (!user) {
      await sendTelegram(chatId,
        '⚠ Chưa liên kết tài khoản.\n\n' +
        'Gõ <code>/start</code> để hướng dẫn liên kết.'
      );
      return NextResponse.json({ ok: true });
    }

    const badge = user.badge ?? 'bronze'
    const bc = BADGE_CONFIG[badge] ?? BADGE_CONFIG.bronze
    const score = user.reputation_score ?? 0

    // Progress bar text
    let progressText = ''
    if (bc.nextScore) {
      const pct = Math.min(100, Math.round((score / bc.nextScore) * 100))
      const filled = Math.round(pct / 10)
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled)
      progressText = `\n[${bar}] ${pct}%\n${score}/${bc.nextScore} → ${bc.next}`
    } else {
      progressText = '\n🏆 Đã đạt cấp cao nhất!'
    }

    // Lịch sử gần nhất
    const { data: logs } = await supabase
      .from('reputation_log')
      .select('delta, reason, notes, created_at')
      .eq('user_id', (await supabase.from('users').select('id').eq('telegram_chat_id', chatId).single()).data?.id)
      .order('created_at', { ascending: false })
      .limit(3)

    let historyText = ''
    if (logs && logs.length > 0) {
      historyText = '\n\n<b>Gần đây:</b>\n' + logs.map(l =>
        `${l.delta > 0 ? '▲' : '▼'} ${l.delta > 0 ? '+' : ''}${l.delta} — ${l.notes ?? l.reason}`
      ).join('\n')
    }

    await sendTelegram(chatId,
      `${bc.icon} <b>Reputation của @${user.handle}</b>\n\n` +
      `Cấp bậc: <b>${bc.label}</b>\n` +
      `Điểm uy tín: <b>${score}</b>\n` +
      progressText +
      `\n\nĐã bán: <b>${user.total_pairs_sold ?? 0}</b> pairs\n` +
      `Doanh số: <b>${((user.total_volume_vnd ?? 0) / 1_000_000).toFixed(1)}M</b> VNĐ` +
      historyText
    )

    return NextResponse.json({ ok: true });
  }
  // ─────────────────────────────────────────────────────────────

  // Các lệnh admin
  if (text.startsWith('/')) {
    const parts = text.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

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

  // Fallback /help
  await sendTelegram(chatId,
    '📋 <b>Các lệnh có sẵn:</b>\n\n' +
    '<code>/start</code> — Hướng dẫn liên kết tài khoản\n' +
    '<code>/link MÃ</code> — Liên kết với tài khoản 16Store\n' +
    '<code>/unlink</code> — Hủy liên kết\n' +
    '<code>/score</code> — Xem điểm uy tín & badge của bạn\n' +
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