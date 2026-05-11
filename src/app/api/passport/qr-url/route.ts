import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  try {
    const { passportId, qrUrl } = await req.json();
    if (!passportId || !qrUrl) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('universal_assets')
      .update({ qr_url: qrUrl })
      .eq('id', passportId);

    if (error) {
      console.error('[qr-url API]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
