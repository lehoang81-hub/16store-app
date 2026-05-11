import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url param', { status: 400 });
  }

  // Chỉ cho phép Cloudinary URLs — bảo mật cơ bản
  if (!url.includes('cloudinary.com')) {
    return new NextResponse('Forbidden: only Cloudinary URLs allowed', { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': '16store-poster-renderer/1.0' },
    });

    if (!res.ok) {
      return new NextResponse(`Upstream error: ${res.status}`, { status: 502 });
    }

    const blob = await res.blob();

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[img-proxy] fetch failed:', err);
    return new NextResponse('Fetch failed', { status: 502 });
  }
}
