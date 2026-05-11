import { createClient } from '@supabase/supabase-js';
import { SubmitPostForm } from '@/components/SubmitPostForm';

export const metadata = {
  title: 'Submit Shoe | 16Store',
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getCurrentUser() {
  // TODO: Replace with actual auth session
  return {
    id: 'd72e5a74-f662-4c2e-89ee-cb5beb1b6820', // ← user_id thực từ users table
    email: 'lehoang81@gmail.com',
  };
}

async function getHubIdByCode(code: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('hubs')
      .select('id')
      .eq('code', code)
      .single();
    if (error) return null;
    return data?.id || null;
  } catch {
    return null;
  }
}

export default async function SubmitPage() {
  const user = await getCurrentUser();
  const defaultHubId = await getHubIdByCode('hcm-01');

  return (
    <div className="min-h-screen bg-ink">
      <div className="border-b border-line px-8 py-4">
        <p className="font-mono text-xs uppercase tracking-wider text-concrete">
          <span className="text-hazard">16 Store</span> / Submit
        </p>
      </div>
      <SubmitPostForm
        sellerId={user.id}
        defaultHubId={defaultHubId || ''}
      />
    </div>
  );
}