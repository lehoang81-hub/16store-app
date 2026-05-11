import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get('handle');
  if (!handle) return NextResponse.json({ error: 'Missing handle' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: userView } = await supabase
    .from('users_view')
    .select('id, handle')
    .eq('handle', handle.toLowerCase().replace('@', ''))
    .single();

  if (!userView) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });

  const { data: userFull } = await supabase
    .from('users')
    .select('reward_points, trust_score, reputation_score, display_name')
    .eq('user_id', userView.id)
    .single();

  return NextResponse.json({
    handle:  userView.handle,
    name:    userFull?.display_name ?? userView.handle,
    hlr:     userFull?.reward_points ?? 0,
    trust:   userFull?.trust_score ?? userFull?.reputation_score ?? 0,
  });
}
