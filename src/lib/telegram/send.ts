import { createServiceClient } from '@/lib/supabase/service';
import type { NotificationEvent } from '@/types/database';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export interface SendNotificationInput {
  user_id: string;
  event: NotificationEvent;
  payload?: Record<string, unknown>;
  message: string;
}

/**
 * Gửi thông báo qua Telegram cho user.
 * Schema mới: dùng users_view thay vì users
 * Không throw nếu fail (best-effort).
 */
export async function sendNotification(input: SendNotificationInput): Promise<void> {
  // Dùng service client để bypass RLS
  const supabase = createServiceClient();

  // Schema mới: dùng users_view (alias user_id → id)
  const { data: user } = await supabase
    .from('users_view')
    .select('telegram_chat_id, notifications_enabled')
    .eq('id', input.user_id)
    .single();

  if (!user?.telegram_chat_id || !user.notifications_enabled) {
    await supabase.from('notifications').insert({
      user_id: input.user_id,
      channel: 'telegram',
      event: input.event,
      payload: input.payload ?? {},
      message: input.message,
      delivered: false,
      delivered_at: null,
      error: !user?.telegram_chat_id ? 'no_telegram_link' : 'notifications_disabled',
    } as never);
    return;
  }

  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set, skipping');
    await supabase.from('notifications').insert({
      user_id: input.user_id,
      channel: 'telegram',
      event: input.event,
      payload: input.payload ?? {},
      message: input.message,
      delivered: false,
      delivered_at: null,
      error: 'bot_token_missing',
    } as never);
    return;
  }

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegram_chat_id,
        text: input.message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const result = await response.json();

    await supabase.from('notifications').insert({
      user_id: input.user_id,
      channel: 'telegram',
      event: input.event,
      payload: input.payload ?? {},
      message: input.message,
      delivered: result.ok,
      delivered_at: result.ok ? new Date().toISOString() : null,
      error: result.ok ? null : (result.description ?? 'telegram_api_error'),
    } as never);

  } catch (err) {
    console.error('[telegram] Send failed:', err);
    await supabase.from('notifications').insert({
      user_id: input.user_id,
      channel: 'telegram',
      event: input.event,
      payload: input.payload ?? {},
      message: input.message,
      delivered: false,
      delivered_at: null,
      error: err instanceof Error ? err.message : 'unknown_error',
    } as never);
  }
}
