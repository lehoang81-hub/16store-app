// src/app/api/og/passport/route.tsx
// 16STORE — OG Image cho Passport share preview
// FIX cho Next.js 15 + Turbopack: dùng edge runtime để bypass bug node binary @vercel/og

import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Nhận data qua query params — KHÔNG query DB (tránh edge runtime hạn chế)
    const qr = searchParams.get('qr') || '16S-XXX';
    const brand = searchParams.get('brand') || 'Unknown Brand';
    const model = searchParams.get('model') || 'Unknown Model';
    const colorway = searchParams.get('colorway') || '';
    const cities = searchParams.get('cities') || '0';
    const scans = searchParams.get('scans') || '0';
    const owners = searchParams.get('owners') || '1';
    const lot = searchParams.get('lot') || '';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#141416',
            color: '#ebe6dc',
            fontFamily: 'sans-serif',
            padding: '60px',
            position: 'relative',
          }}
        >
          {/* Top stripe — hazard amber */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '12px',
              backgroundColor: '#e0a23a',
              display: 'flex',
            }}
          />

          {/* Header row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '40px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  backgroundColor: '#c8531c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#141416',
                  fontSize: '28px',
                  fontWeight: 900,
                }}
              >
                16
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    letterSpacing: '4px',
                    color: '#a8a89d',
                    textTransform: 'uppercase',
                    display: 'flex',
                  }}
                >
                  16Store Passport
                </div>
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 900,
                    color: '#ebe6dc',
                    letterSpacing: '1px',
                    display: 'flex',
                  }}
                >
                  A MEMORY STORE
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                fontSize: '14px',
                color: '#8a8a80',
                fontFamily: 'monospace',
                letterSpacing: '2px',
              }}
            >
              ● LIVE TRACKING
            </div>
          </div>

          {/* Main content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'center',
              gap: '20px',
            }}
          >
            {/* Lot badge */}
            {lot && (
              <div
                style={{
                  display: 'flex',
                  fontSize: '16px',
                  fontFamily: 'monospace',
                  color: '#c8531c',
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                }}
              >
                ◆ LOT {lot} · {qr}
              </div>
            )}

            {/* Brand (small, uppercase) */}
            <div
              style={{
                display: 'flex',
                fontSize: '28px',
                color: '#a8a89d',
                letterSpacing: '6px',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              {brand}
            </div>

            {/* Model (huge, display) */}
            <div
              style={{
                display: 'flex',
                fontSize: '96px',
                color: '#ebe6dc',
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: '-2px',
                textTransform: 'uppercase',
              }}
            >
              {model}
            </div>

            {/* Colorway (serif italic accent) */}
            {colorway && (
              <div
                style={{
                  display: 'flex',
                  fontSize: '32px',
                  color: '#c8531c',
                  fontStyle: 'italic',
                  fontFamily: 'serif',
                }}
              >
                {colorway}
              </div>
            )}
          </div>

          {/* Stats row — 3 columns */}
          <div
            style={{
              display: 'flex',
              borderTop: '2px solid #3a3a3c',
              paddingTop: '32px',
              gap: '80px',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: '56px',
                  color: '#c8531c',
                  fontWeight: 900,
                  lineHeight: 1,
                  display: 'flex',
                }}
              >
                {cities}
              </div>
              <div
                style={{
                  fontSize: '14px',
                  color: '#8a8a80',
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                  marginTop: '8px',
                  fontFamily: 'monospace',
                  display: 'flex',
                }}
              >
                ● Cities
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: '56px',
                  color: '#ebe6dc',
                  fontWeight: 900,
                  lineHeight: 1,
                  display: 'flex',
                }}
              >
                {scans}
              </div>
              <div
                style={{
                  fontSize: '14px',
                  color: '#8a8a80',
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                  marginTop: '8px',
                  fontFamily: 'monospace',
                  display: 'flex',
                }}
              >
                ● Scans
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: '56px',
                  color: '#ebe6dc',
                  fontWeight: 900,
                  lineHeight: 1,
                  display: 'flex',
                }}
              >
                {owners}
              </div>
              <div
                style={{
                  fontSize: '14px',
                  color: '#8a8a80',
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                  marginTop: '8px',
                  fontFamily: 'monospace',
                  display: 'flex',
                }}
              >
                ● Owners
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginLeft: 'auto',
                alignItems: 'flex-end',
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  color: '#c8531c',
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                  fontFamily: 'monospace',
                  display: 'flex',
                }}
              >
                Scan to view journey
              </div>
              <div
                style={{
                  fontSize: '18px',
                  color: '#ebe6dc',
                  fontWeight: 900,
                  marginTop: '8px',
                  letterSpacing: '2px',
                  display: 'flex',
                }}
              >
                16STORE.APP
              </div>
            </div>
          </div>

          {/* Bottom stripe — rust */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '8px',
              backgroundColor: '#c8531c',
              display: 'flex',
            }}
          />
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[OG Passport] Error:', message);

    // Fallback image — tối giản để không bao giờ crash
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#141416',
            color: '#ebe6dc',
            fontSize: '48px',
            fontWeight: 900,
            letterSpacing: '4px',
          }}
        >
          16STORE · A MEMORY STORE
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }
}
