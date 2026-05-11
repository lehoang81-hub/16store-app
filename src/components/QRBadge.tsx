'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/passport`
  : 'https://16store-app.vercel.app/passport';

// ── QR Display + auto-upload ──────────────────────────────────
interface QRDisplayProps {
  qrCode: string;
  passportId?: string;
  size?: number;
}

export function QRMiniDisplay({ qrCode, passportId, size = 72 }: QRDisplayProps) {
  const svgRef     = useRef<SVGSVGElement | null>(null);
  const [hovered,  setHovered]  = useState(false);
  const [enlarged, setEnlarged] = useState(false);

  const qrUrl = `${BASE_URL}/${qrCode}`;

  const innerSize = size - 8;

  return (
    <>
      <div
        style={{ position:'relative', display:'inline-block', cursor:'pointer' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setEnlarged(true)}
        title="Click để phóng to · Scan để xem hộ chiếu"
      >
        <div style={{
          background: '#ffffff',
          padding: 4, borderRadius: 4, lineHeight: 0,
          border: `1px solid ${hovered ? 'rgba(200,83,28,0.7)' : 'rgba(200,83,28,0.3)'}`,
          boxShadow: hovered ? '0 0 16px rgba(200,83,28,0.5)' : '0 0 6px rgba(200,83,28,0.15)',
          transition: 'all 0.2s',
        }}>
          <QRCodeSVG
            ref={(el: SVGSVGElement | null) => { svgRef.current = el; }}
            value={qrUrl}
            size={innerSize}
            level="H"
            fgColor="#1a0805"
            bgColor="#ffffff"
            imageSettings={{
              src: '/logo-qr.png',
              height: Math.round(innerSize * 0.22),
              width:  Math.round(innerSize * 0.22),
              excavate: true,
            }}
          />
        </div>

        {/* Scan hint */}
        {hovered && (
          <div style={{
            position: 'absolute', bottom: '108%', left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(10,10,20,0.95)',
            border: '0.5px solid rgba(200,83,28,0.5)',
            borderRadius: 4, padding: '4px 10px',
            fontFamily: "'Space Mono',monospace",
            fontSize: 8, letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.7)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none', zIndex: 10,
          }}>
            📷 Click phóng to · Scan để xem passport
          </div>
        )}
      </div>

      {/* Fullscreen modal */}
      {enlarged && (
        <div
          onClick={() => setEnlarged(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12,
              padding: 32, textAlign: 'center',
              boxShadow: '0 0 60px rgba(0,0,0,0.6)',
            }}
          >
            <QRCodeSVG
              value={qrUrl}
              size={280}
              level="H"
              fgColor="#1a0805"
              bgColor="#ffffff"
              imageSettings={{
                src: '/logo-qr.png',
                height: 56, width: 56,
                excavate: true,
              }}
            />
            <div style={{
              marginTop: 16, fontFamily: "'Space Mono',monospace",
              fontSize: 11, letterSpacing: '0.18em',
              color: '#C8531C', textTransform: 'uppercase',
            }}>
              {qrCode}
            </div>
            <div style={{ fontSize: 9, color: '#999', marginTop: 4, fontFamily: 'monospace' }}>
              {qrUrl}
            </div>
            <button
              onClick={() => setEnlarged(false)}
              style={{
                marginTop: 20, padding: '8px 24px',
                background: '#C8531C', color: '#fff',
                border: 'none', borderRadius: 4,
                fontFamily: "'Space Mono',monospace",
                fontSize: 10, letterSpacing: '0.15em',
                textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── ID Badge với particle effect ──────────────────────────────
export function IDParticleBadge({ qrCode }: { qrCode: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const animRef   = useRef<number>(0);
  const pidRef    = useRef(0);
  const pRef      = useRef<{
    x:number; y:number; vx:number; vy:number; life:number; maxLife:number; size:number;
  }[]>([]);
  const ACCENT = '#C8531C';

  const draw = useCallback(() => {
    const c = canvasRef.current;
    const w = wrapRef.current;
    if (!c || !w) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    c.width  = w.offsetWidth;
    c.height = w.offsetHeight;
    const cx = c.width / 2, cy = c.height / 2;
    ctx.clearRect(0, 0, c.width, c.height);

    // Spawn
    const a  = Math.random() * Math.PI * 2;
    const rx = c.width / 2 + 14 + Math.random() * 10;
    const ry = c.height / 2 + 8 + Math.random() * 8;
    const px = cx + Math.cos(a) * rx;
    const py = cy + Math.sin(a) * ry;
    pRef.current.push({
      x:px, y:py,
      vx:(cx-px)*0.05, vy:(cy-py)*0.05,
      life:0, maxLife: 28+Math.random()*18,
      size: 1+Math.random()*1.5,
    });
    if (pRef.current.length > 50) pRef.current = pRef.current.slice(-50);

    // Draw
    pRef.current = pRef.current.filter(p => p.life < p.maxLife);
    for (const p of pRef.current) {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.97; p.vy *= 0.97;
      p.life++;
      const t = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size*(1-t*0.4), 0, Math.PI*2);
      ctx.fillStyle   = ACCENT;
      ctx.globalAlpha = (1-t)*0.85;
      ctx.shadowColor = ACCENT;
      ctx.shadowBlur  = 8;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    animRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <div ref={wrapRef} style={{ position:'relative', display:'inline-block', padding:'4px 0' }}>
      <canvas ref={canvasRef} style={{
        position:'absolute', inset:'-10px -14px',
        width:'calc(100% + 28px)', height:'calc(100% + 20px)',
        pointerEvents:'none', zIndex:0,
      }}/>
      <span style={{
        position:'relative', zIndex:1,
        display:'inline-block',
        fontFamily:"'Space Mono',monospace",
        fontSize:10, fontWeight:700,
        letterSpacing:'0.2em', textTransform:'uppercase',
        color:'#C8531C',
        background:'rgba(200,83,28,0.08)',
        border:'1px solid rgba(200,83,28,0.3)',
        padding:'5px 12px', borderRadius:2,
      }}>
        {qrCode}
      </span>
    </div>
  );
}
