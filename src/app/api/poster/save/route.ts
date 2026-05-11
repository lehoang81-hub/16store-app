import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

// ── POST /api/poster/save ─────────────────────────────────────
// Chỉ lưu posterUrl vào DB — upload đã làm ở client
export async function POST(req: NextRequest) {
  try {
    const { passportId, posterUrl } = await req.json();

    if (!passportId || !posterUrl) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('universal_assets')
      .update({ poster_url: posterUrl })
      .eq('id', passportId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, posterUrl });

  } catch (err) {
    console.error('[poster/save]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
