import { createClient } from '@/lib/supabase/server';
import type { Hub } from '@/types/database';

export async function getAllHubs(): Promise<Hub[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('hubs')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[getAllHubs]', error);
    return [];
  }
  return data ?? [];
}
