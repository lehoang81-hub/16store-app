import { createClient } from '@/lib/supabase/server';
import type { User } from '@/types/database';

/**
 * Lấy user hiện tại từ session.
 * Schema: users table dùng auth_id để link với Supabase Auth
 * → Query users_view theo auth_id (không phải user_id)
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: profile, error } = await supabase
    .from('users_view')
    .select('*')
    .eq('auth_id', authUser.id)  // ← dùng auth_id để match với Supabase Auth
    .single();

  if (error || !profile) {
    console.error('[getCurrentUser]', error);
    return null;
  }

  return profile as User;
}
