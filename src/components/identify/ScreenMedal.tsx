'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CaptureData, ScanResult } from './IdentifyFlow';
import { PosterCanvas } from '@/components/PosterCanvas';

const CLOUD  = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? 'donkfupjv';
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '16store_identify';

async function uploadPosterToCloudinary(dataUrl: string, passportId: string): Promise<string | null> {
  try {
    // Compress PNG → JPEG 75% (~890KB → ~120KB)
    const compressed = await new Promise<string>(resolve => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        c.getContext('2d')!.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/jpeg', 0.75));
      };
      img.src = dataUrl;
    });
    const form = new FormData();
    form.append('file',          compressed);
    form.append('upload_preset', PRESET);
    form.append('folder',        `16store/posters/${passportId}`);
    
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
      method: 'POST', body: form,
    });
    if (!res.ok) { console.error('[poster upload]', await res.text()); return null; }
    const data = await res.json();
    return (data.secure_url as string).replace('/upload/', '/upload/f_auto,q_auto,w_1080/');
  } catch (err) {
    console.error('[poster upload]', err);
    return null;
  }
}


interface Props {
  result: ScanResult;
  captureData: CaptureData;
  userHandle: string;
  onReset: () => void;
}

export function ScreenMedal({ result, captureData, userHandle, onReset }: Props) {
  const router = useRouter();
  const [stampVisible, setStampVisible] = useState(false);
  const [hlrVisible, setHlrVisible] = useState(false);
  const [seconds, setSeconds] = useState(() => {
    const diff = new Date(result.claimWindowExpiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  });
  const [posterUrl,    setPosterUrl]    = useState<string | null>(null);
  const [posterSaving, setPosterSaving] = useState(false);
  const confettiRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const cardRef = useRef<HTMLDivElement>(null);

  const ACCENT = captureData.tier === 'elite' ? '#d4af37' : captureData.tier === 'heritage' ? '#b8eaff' : '#c8531c';
  const TIER_LABEL = captureData.tier === 'elite' ? '◆ ELITE' : captureData.tier === 'heritage' ? '⬡ HERITAGE' : 'STANDARD';

  // Confetti
  useEffect(() => {
    if (!confettiRef.current) return;
    const colors = [ACCENT, '#fff', '#4ade80', 'rgba(255,255,255,0.6)'];
    for (let i = 0; i < 60; i++) {
      const el = document.createElement('div');
      const size = 3 + Math.random() * 5;
      Object.assign(el.style, {
        position: 'absolute',
        width: size + 'px', height: size + 'px',
        borderRadius: Math.random() > 0.5 ? '50%' : '1px',
        background: colors[Math.floor(Math.random() * colors.length)],
        left: Math.random() * 100 + '%',
        top: '-10px',
        opacity: '0',
        animation: `confFall ${1.5 + Math.random() * 2}s ease-in ${Math.random() * 2}s 1 forwards`,
      });
      confettiRef.current.appendChild(el);
    }

    setTimeout(() => setStampVisible(true), 300);
    setTimeout(() => setHlrVisible(true), 900);
  }, []);

  // Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 3D tilt on passport
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    mouseRef.current = { x, y };
    if (cardRef.current) {
      const rotX = -(y - 0.5) * 14;
      const rotY = (x - 0.5) * 14;
      cardRef.current.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      const shineX = (x * 100).toFixed(1) + '%';
      const shineY = (y * 100).toFixed(1) + '%';
      cardRef.current.style.setProperty('--sx', shineX);
      cardRef.current.style.setProperty('--sy', shineY);
    }
  };

  const handleMouseLeave = () => {
    if (cardRef.current) {
      cardRef.current.style.transform = 'rotateX(0) rotateY(0)';
    }
  };

  const formatCountdown = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handlePosterReady = async (dataUrl: string) => {
    console.log('[ScreenMedal] posterReady, passportId:', result.passportId);
    if (!result.passportId || posterSaving) return;
    setPosterSaving(true);
    try {
      const cloudUrl = await uploadPosterToCloudinary(dataUrl, result.passportId);
      if (!cloudUrl) return;
      const res  = await fetch('/api/poster/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passportId: result.passportId, posterUrl: cloudUrl }),
      });
      const data = await res.json();
      setPosterUrl(data.posterUrl ?? cloudUrl);
    } catch (err) {
      console.error('[ScreenMedal] poster failed:', err);
    } finally {
      setPosterSaving(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: '100px 24px 40px',
      position: 'relative', zIndex: 10, gap: 16,
    }}>

      {/* Confetti */}
      <div ref={confettiRef} style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none', overflow: 'hidden',
      }} />

      <div style={{
        fontSize: 8, letterSpacing: '0.25em',
        color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
      }}>
        NGHI THỨC HOÀN TẤT
      </div>

      {/* Passport card with 3D tilt */}
      <div
        style={{ perspective: '1200px', cursor: 'pointer' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={cardRef}
          style={{
            width: 280,
            background: captureData.tier === 'heritage'
              ? 'linear-gradient(135deg, #000a1a, #000510, #0a0015)'
              : captureData.tier === 'elite'
              ? 'linear-gradient(135deg, #1a1500, #0d0d0f, #1a1200)'
              : 'linear-gradient(135deg, #1a1208, #0d0d0f, #1a0a05)',
            border: `0.5px solid ${ACCENT}40`,
            borderRadius: 12,
            padding: '22px 20px',
            position: 'relative', overflow: 'hidden',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.1s ease-out',
          }}
        >
          {/* Shine overlay */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 12,
            background: `radial-gradient(circle at var(--sx, 50%) var(--sy, 50%), ${ACCENT}25 0%, transparent 60%)`,
            pointerEvents: 'none',
          }} />

          {/* Heritage holographic */}
          {captureData.tier === 'heritage' && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 12,
              background: 'repeating-linear-gradient(45deg, rgba(255,100,100,0.03) 0px, rgba(100,255,200,0.03) 8px, rgba(100,100,255,0.03) 16px)',
              pointerEvents: 'none',
            }} />
          )}

          {/* Content */}
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 20, color: ACCENT, letterSpacing: '0.04em', marginBottom: 2,
          }}>
            16STORE
          </div>
          <div style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 7, letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', marginBottom: 14,
          }}>
            {result.serialNumber} · {captureData.tier.toUpperCase()} · 2026
          </div>

          <div style={{ height: 0.5, background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`, opacity: 0.3, marginBottom: 14 }} />

          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, lineHeight: 0.95, marginBottom: 3 }}>
            {captureData.brand.toUpperCase()}
          </div>
          <div style={{
            fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
            fontSize: 14, color: ACCENT, marginBottom: 6,
          }}>
            {captureData.model}
          </div>
          {captureData.colorway && (
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 14 }}>
              · {captureData.colorway} ·
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 8, letterSpacing: '0.12em',
              color: 'rgba(255,255,255,0.2)',
            }}>
              {TIER_LABEL}
            </span>
          </div>

          {/* THE FIRST stamp */}
          {result.isFirstClaim && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              border: `1.5px solid ${ACCENT}`, padding: '4px 10px',
              transform: 'rotate(-2deg)',
              opacity: stampVisible ? 1 : 0,
              transition: 'opacity 0.3s',
              animation: stampVisible ? 'stampIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: ACCENT, animation: 'pulse 2s infinite',
              }} />
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 13, letterSpacing: '0.15em', color: ACCENT,
              }}>
                THE FIRST CLAIMANT
              </span>
            </div>
          )}

          <div style={{
            marginTop: 8, fontSize: 7,
            color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em',
          }}>
            {result.qrCode}
          </div>
        </div>
      </div>

      {/* HLR Reward */}
      {hlrVisible && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: `${ACCENT}15`,
          border: `0.5px solid ${ACCENT}40`,
          padding: '10px 20px', borderRadius: 4,
          animation: 'slideUp 0.4s ease forwards',
        }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 28, color: ACCENT,
          }}>
            +{result.hlrReward}
          </div>
          <div>
            <div style={{ fontSize: 9, color: ACCENT, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              HLR REWARD
            </div>
            <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', marginTop: 2 }}>
              Đóng góp di sản cộng đồng
            </div>
          </div>
        </div>
      )}

      {/* Countdown */}
      {result.isFirstClaim && (
        <div style={{
          fontSize: 9, letterSpacing: '0.15em',
          color: 'rgba(255,255,255,0.3)',
          textAlign: 'center', lineHeight: 1.8, textTransform: 'uppercase',
        }}>
          Danh hiệu trở thành vĩnh viễn trong{' '}
          <span style={{ color: ACCENT, fontWeight: 700 }}>
            {formatCountdown(seconds)}
          </span>
        </div>
      )}

      {/* Hidden PosterCanvas — auto-generate & upload */}
      <div style={{ position: 'absolute', left: -9999, top: 0, width: 360, opacity: 0, pointerEvents: 'none' }}>
        <PosterCanvas
          concept="archive"
          data={{
            brand:     captureData.brand,
            model:     captureData.model,
            colorway:  captureData.colorway,
            qrCode:    result.qrCode ?? '',
            heroUrl:   (captureData as any).uploadedUrls?.hero ?? '',
            variant:   'identity',
            soulScore: 50,
          }}
          onReady={handlePosterReady}
        />
      </div>

      {/* Poster preview */}
      {posterUrl && (
        <div style={{ width: '100%', maxWidth: 280, position: 'relative' }}>
          <img src={posterUrl} alt="Poster" style={{ width: '100%', display: 'block', border: `1px solid ${ACCENT}30` }} />
          <div style={{ position: 'absolute', bottom: 8, right: 8, fontFamily: 'monospace', fontSize: 8, color: ACCENT, background: 'rgba(0,0,0,0.7)', padding: '2px 6px' }}>
            ✓ POSTER ĐÃ LƯU
          </div>
        </div>
      )}
      {posterSaving && !posterUrl && (
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: ACCENT, letterSpacing: '0.12em', opacity: 0.6 }}>
          Đang tạo poster...
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => router.push(`/passport/${result.qrCode}`)}
          style={{
            padding: '12px 28px',
            background: ACCENT, color: '#000',
            border: 'none', borderRadius: 2,
            fontFamily: "'Space Mono', monospace",
            fontSize: 10, letterSpacing: '0.2em',
            textTransform: 'uppercase', cursor: 'pointer',
          }}
        >
          XEM HỘ CHIẾU
        </button>
        <button
          onClick={() => router.push(`/passport/${result.qrCode}?action=listing`)}
          style={{
            padding: '12px 28px',
            background: 'transparent',
            border: `1px solid ${ACCENT}`,
            color: ACCENT, borderRadius: 2,
            fontFamily: "'Space Mono', monospace",
            fontSize: 10, letterSpacing: '0.2em',
            textTransform: 'uppercase', cursor: 'pointer',
          }}
        >
          KÝ GỬI BÁN →
        </button>
        <button
          onClick={onReset}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: '0.5px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.4)', borderRadius: 2,
            fontFamily: "'Space Mono', monospace",
            fontSize: 9, letterSpacing: '0.15em',
            textTransform: 'uppercase', cursor: 'pointer',
          }}
        >
          Định danh mới
        </button>
      </div>

      <style>{`
        @keyframes stampIn {
          from { opacity:0; transform: scale(1.4) rotate(-3deg); }
          to { opacity:1; transform: scale(1) rotate(-2deg); }
        }
        @keyframes pulse {
          0%,100% { opacity:1; }
          50% { opacity:0.3; }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(12px); }
          to { opacity:1; transform:translateY(0); }
        }
        @keyframes confFall {
          0% { top:-10px; opacity:0; transform:rotate(0deg); }
          20% { opacity:1; }
          80% { opacity:0.8; }
          100% { top:110%; opacity:0; transform:rotate(360deg) translateX(40px); }
        }
      `}</style>
    </div>
  );
}
