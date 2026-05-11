'use server';

import { createClient } from '@/lib/supabase/server';

export async function createTelegramLinkToken(): Promise<{ token: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: 'Bạn cần đăng nhập' };

  // Sinh token ngắn 8 ký tự dạng XXXX-XXXX
  const part = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  const token = `${part()}-${part()}`;

  const { error } = await supabase.from('telegram_link_tokens').insert({
    token,
    user_id: user.id,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    used_at: null,
  } as never);

  if (error) return { error: error.message };
  return { token };
}

export async function unlinkTelegram(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('users')
    .update({ telegram_chat_id: null, telegram_username: null } as never)
    .eq('id', user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
