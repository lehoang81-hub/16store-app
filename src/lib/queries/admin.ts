import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { PostWithSeller, Hub } from '@/types/database';

/**
 * Lấy hub mà user hiện tại quản lý (dùng cho hub_admin)
 * Note: hubs table không có managed_by_user_id → dùng users_view.hub_id
 */
export async function getMyManagedHub(userId: string): Promise<Hub | null> {
  const supabase = await createClient();

  // Lấy hub_id từ user profile
  const { data: userProfile } = await supabase
    .from('users_view')
    .select('hub_id')
    .eq('id', userId)
    .single();

  if (!userProfile?.hub_id) return null;

  const { data, error } = await supabase
    .from('hubs')
    .select('*')
    .eq('id', userProfile.hub_id)
    .single();

  if (error || !data) return null;
  return data as Hub;
}

/**
 * Lấy tất cả hub (cho super_admin)
 */
export async function getAllHubsForAdmin(): Promise<Hub[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('hubs')
    .select('*')
    .order('name');
  return (data ?? []) as Hub[];
}

/**
 * Lấy pair đang chờ verify của hub cụ thể
 * Schema mới: status='draft' (backup dùng 'pending_verify')
 */
export async function getPendingPostsByHub(hubId: string): Promise<PostWithSeller[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('posts_with_seller')
    .select('*')
    .eq('hub_id', hubId)
    .eq('status', 'draft')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[getPendingPostsByHub]', error);
    return [];
  }
  return (data ?? []) as PostWithSeller[];
}

/**
 * Stats cho hub admin dashboard
 */
export async function getHubAdminStats(hubId: string) {
  const supabase = createServiceClient();

  const { data: posts } = await supabase
    .from('posts')
    .select('status, asking_price_vnd, sold_at')
    .eq('hub_id', hubId);

  const byStatus = (posts ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const revenueMtd = (posts ?? [])
    .filter((p) => p.status === 'sold' && p.sold_at && new Date(p.sold_at) >= startOfMonth)
    .reduce((sum, p) => sum + (p.asking_price_vnd ?? 0), 0);

  const soldMtd = (posts ?? [])
    .filter((p) => p.status === 'sold' && p.sold_at && new Date(p.sold_at) >= startOfMonth)
    .length;

  return {
    // Schema mới: draft thay vì pending_verify
    pending_verify: byStatus.draft ?? 0,
    pending_payment: byStatus.pending_payment ?? 0,
    live: byStatus.live ?? 0,
    sold: byStatus.sold ?? 0,
    sold_mtd: soldMtd,
    revenue_mtd: revenueMtd,
    total: posts?.length ?? 0,
  };
}

/**
 * Overview stats cho super_admin
 */
export async function getSuperAdminOverview() {
  const supabase = createServiceClient();

  const [postsRes, hubsRes, usersRes] = await Promise.all([
    supabase.from('posts').select('id, status, hub_id, asking_price_vnd, sold_at, created_at'),
    supabase.from('hubs').select('*'),
    supabase.from('users_view').select('id, role, created_at'),
  ]);

  const posts = postsRes.data ?? [];
  const hubs = hubsRes.data ?? [];
  const users = usersRes.data ?? [];

  const byStatus = posts.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const revenueMtd = posts
    .filter((p) => p.status === 'sold' && p.sold_at && new Date(p.sold_at) >= startOfMonth)
    .reduce((sum, p) => sum + (p.asking_price_vnd ?? 0), 0);

  const hubBreakdown = hubs.map((h) => {
    const hubPosts = posts.filter((p) => p.hub_id === h.id);
    const pending = hubPosts.filter((p) => p.status === 'draft').length;
    const live = hubPosts.filter((p) => p.status === 'live').length;
    const soldMtd = hubPosts.filter(
      (p) => p.status === 'sold' && p.sold_at && new Date(p.sold_at) >= startOfMonth
    ).length;
    const revenueHubMtd = hubPosts
      .filter((p) => p.status === 'sold' && p.sold_at && new Date(p.sold_at) >= startOfMonth)
      .reduce((sum, p) => sum + (p.asking_price_vnd ?? 0), 0);

    return {
      ...h,
      pending,
      live,
      sold_mtd: soldMtd,
      revenue_mtd: revenueHubMtd,
      total: hubPosts.length,
    };
  }).sort((a, b) => b.revenue_mtd - a.revenue_mtd);

  return {
    total_pending: byStatus.draft ?? 0,
    total_live: byStatus.live ?? 0,
    total_sold: byStatus.sold ?? 0,
    total_pairs: posts.length,
    total_users: users.length,
    total_hub_admins: users.filter((u) => u.role === 'hub_admin').length,
    revenue_mtd: revenueMtd,
    hubs: hubBreakdown,
    bottleneck_hubs: hubBreakdown.filter((h) => h.pending > 5),
  };
}
