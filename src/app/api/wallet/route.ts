import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentUser } from '@/lib/queries/current-user';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createServiceClient();

    const [{ data: userData }, { data: txns }] = await Promise.all([
      supabase.from('users').select('wallet_balance_vnd').eq('id', user.id).single(),
      supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    return NextResponse.json({
      balance:      userData?.wallet_balance_vnd ?? 0,
      transactions: txns ?? [],
    });
  } catch (err) {
    console.error('[wallet/get]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
