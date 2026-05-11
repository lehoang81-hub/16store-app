import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { IdentifyFlow } from '@/components/identify/IdentifyFlow';
import { Nav } from '@/components/Nav';

export const metadata = {
  title: 'Định danh Di sản | 16Store',
  description: 'Khai sinh vật phẩm của bạn vào vũ trụ HLRace. Mỗi vật phẩm là một câu chuyện bất tử.',
};

async function getStats() {
  const supabase = await createClient();
  const { count: totalAssets } = await supabase
    .from('universal_assets')
    .select('*', { count: 'exact', head: true });

  const { count: todayCount } = await supabase
    .from('universal_assets')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 86400000).toISOString());

  const { count: openWindows } = await supabase
    .from('universal_assets')
    .select('*', { count: 'exact', head: true })
    .is('first_claimant_id', null)
    .gt('claim_window_expires_at', new Date().toISOString());

  return {
    total: totalAssets ?? 0,
    today: todayCount ?? 0,
    openWindows: openWindows ?? 0,
  };
}

export default async function IdentifyPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login?redirect=/identify');
  }

  const { data: userProfile } = await supabase
    .from('users_view')
    .select('id, handle, display_name, hub_id')
    .eq('auth_id', authUser.id)
    .single();

  if (!userProfile) redirect('/login?redirect=/identify');

  const stats = await getStats();

  return (
    <>
      <Nav />
      <IdentifyFlow
        userId={userProfile.id}
        userHandle={userProfile.handle ?? 'unknown'}
        stats={stats}
      />
    </>
  );
}
