import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

const CLOUD  = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

// ── POST /api/poster/generate ─────────────────────────────────
// Nhận base64 dataUrl từ client → upload Cloudinary → lưu poster_url
export async function POST(req: NextRequest) {
  try {
    const { passportId, dataUrl } = await req.json();

    if (!passportId || !dataUrl) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    // Upload lên Cloudinary
    const form = new FormData();
    form.append('file',           dataUrl);
    form.append('upload_preset',  PRESET);
    form.append('folder',         `16store/posters/${passportId}`);
    form.append('public_id',      'cover');
    form.append('overwrite',      'true');
    form.append('tags',           'poster,identity');

    const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
      method: 'POST',
      body:   form,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[poster/generate] Cloudinary error:', err);
      return NextResponse.json({ error: 'Upload failed' }, { status: 502 });
    }

    const data      = await res.json();
    const posterUrl = data.secure_url as string;

    // CDN optimize URL
    const optimizedUrl = posterUrl.replace(
      '/upload/',
      '/upload/f_auto,q_auto,w_1080/'
    );

    // Lưu vào DB
    const supabase = createServiceClient();
    await supabase
      .from('universal_assets')
      .update({ poster_url: optimizedUrl })
      .eq('id', passportId);

    return NextResponse.json({ success: true, posterUrl: optimizedUrl });

  } catch (err) {
    console.error('[poster/generate]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
