import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { PostWithSeller } from '@/types/database';

export async function getFeaturedPosts(limit = 6): Promise<PostWithSeller[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('posts_with_seller')
    .select('*')
    .eq('status', 'live')
    .eq('is_featured', true)
    .order('listed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getFeaturedPosts]', error);
    return [];
  }
  return data ?? [];
}

export async function getFloorPosts(limit = 20): Promise<PostWithSeller[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('posts_with_seller')
    .select('*')
    .in('status', ['live', 'reserved'])
    .order('listed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getFloorPosts]', error);
    return [];
  }
  return data ?? [];
}

export async function getPostByLotId(lotId: string): Promise<PostWithSeller | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('posts_with_seller')
    .select('*')
    .eq('lot_id', lotId)
    .single();

  if (error) {
    console.error('[getPostByLotId]', error);
    return null;
  }
  return data;
}

export async function incrementViewCount(postId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('posts')
    .select('view_count')
    .eq('id', postId)
    .single();

  await supabase
    .from('posts')
    .update({ view_count: (data?.view_count ?? 0) + 1 })
    .eq('id', postId);
}

export async function getPlatformStats() {
  const supabase = createServiceClient();

  const [postsRes, hubsRes] = await Promise.all([
    supabase.from('posts').select('id, status'),
    supabase.from('hubs').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ]);

  const totalVerified = postsRes.data?.filter((p) =>
    ['live', 'reserved', 'sold'].includes(p.status)
  ).length ?? 0;

  const activeHubs = hubsRes.count ?? 0;

  return {
    totalVerified,
    activeHubs,
    avgPayoutHours: 72,
    indexChange: 4.2,
  };
}
