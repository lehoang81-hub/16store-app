// src/app/p/[qrCode]/route.ts
// Route entry point khi user scan QR code từ poster.
// Pattern: /p/{qrCode}?ref={referrerUserId}
//
// Workflow:
// 1. Extract qrCode + ref param
// 2. Track click vào affiliate_clicks (non-blocking)
// 3. Set cookie affiliate_ref (30 days)
// 4. 302 Redirect → /passport/{qrCode}
//
// Note: Dùng path /p/ (not /passport/) để distinguish tracking entry vs direct view.

import { NextResponse, type NextRequest } from 'next/server';
import {
  trackAffiliateClick,
  buildAffiliateCookie,
  getClientIp,
  hashIp,
} from '@/lib/social-card/affiliate-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ qrCode: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { qrCode } = await params;
  const url = new URL(req.url);
  const ref = url.searchParams.get('ref');

  // Build redirect URL (target = /passport/{qrCode})
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : req.nextUrl.origin);
  const redirectTo = `${baseUrl}/passport/${qrCode}`;

  const response = NextResponse.redirect(redirectTo, 302);

  // Nếu có ref param → track click + set cookie
  if (ref && isValidUuid(ref)) {
    // Set cookie (cho phép Sprint 4 đọc khi user convert thành purchase)
    response.headers.append('Set-Cookie', buildAffiliateCookie(ref));

    // Track click — non-blocking, không await để redirect nhanh
    const ip = getClientIp(req.headers);
    const ipHash = ip !== 'unknown' ? hashIp(ip) : undefined;
    const userAgent = req.headers.get('user-agent') ?? undefined;
    const sessionId = req.cookies.get('session')?.value;

    // Fire-and-forget (không block redirect)
    trackAffiliateClick({
      referrerUserId: ref,
      qrCode,
      userAgent,
      ipHash,
      sessionId,
    }).catch((err) => {
      console.error('[p-route] trackClick bg error:', err);
    });
  }

  return response;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Validate UUID format (v4).
 */
function isValidUuid(value: string): boolean {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return UUID_REGEX.test(value);
}
