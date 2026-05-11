'use server';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  category?: string;
  description?: string;
  domain: string;
  created_at: string;
  updated_at: string;
}

/**
 * Lấy tất cả settings cho 16Store (domain='16store')
 * Group by category nếu có
 */
export async function getSettings(groupByCategory: boolean = true) {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('*')
      .eq('domain', '16store')
      .order('category', { ascending: true })
      .order('key', { ascending: true });

    if (error) throw error;

    if (groupByCategory) {
      const grouped = (data || []).reduce(
        (acc, item) => {
          const cat = item.category || 'General';
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(item);
          return acc;
        },
        {} as Record<string, SystemConfig[]>
      );
      return grouped;
    }

    return data || [];
  } catch (err) {
    console.error('[getSettings] Error:', err);
    throw err;
  }
}

/**
 * Cập nhật value của 1 config key
 * Chỉ update rows có domain='16store'
 */
export async function updateSetting(
  key: string,
  newValue: string,
  updatedBy?: string
) {
  try {
    // Validate key format (phải có prefix 16store.)
    if (!key.startsWith('16store.')) {
      throw new Error(
        `Invalid key format. Must start with '16store.'. Got: ${key}`
      );
    }

    const { data, error } = await supabase
      .from('system_config')
      .update({
        value: newValue,
        updated_at: new Date().toISOString(),
      })
      .eq('key', key)
      .eq('domain', '16store')
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error(`Setting key not found: ${key}`);
    }

    console.log(`[updateSetting] Updated ${key} = ${newValue}`);
    return data[0];
  } catch (err) {
    console.error('[updateSetting] Error:', err);
    throw err;
  }
}

/**
 * Thêm mới 1 setting key (nếu chưa tồn tại)
 * Tự động set domain='16store'
 */
export async function createSetting(
  key: string,
  value: string,
  category?: string,
  description?: string
) {
  try {
    if (!key.startsWith('16store.')) {
      throw new Error(
        `Invalid key format. Must start with '16store.'. Got: ${key}`
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('system_config')
      .insert([
        {
          key,
          value,
          category: category || 'General',
          description: description || '',
          domain: '16store',
          created_at: now,
          updated_at: now,
        },
      ])
      .select();

    if (error) throw error;
    console.log(`[createSetting] Created ${key}`);
    return data?.[0];
  } catch (err) {
    console.error('[createSetting] Error:', err);
    throw err;
  }
}

/**
 * Helper: Lấy 1 setting value theo key
 * Return null nếu không tồn tại
 */
export async function getSetting(key: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', key)
      .eq('domain', '16store')
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data?.value || null;
  } catch (err) {
    console.error('[getSetting] Error:', err);
    return null;
  }
}
