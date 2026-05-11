'use client';

import { useState, useEffect } from 'react';
import { QRMiniDisplay } from '@/components/QRBadge';

interface Props {
  qrCode:         string;
  passportId:     string;
  brand:          string;
  model:          string;
  colorway?:      string | null;
  objectLabel:    string;
  journeyScore:   number;
  isOwner:        boolean;
  isLost:         boolean;
  posterUrl:      string | null;
  coverImageUrl:  string | null;
  identityStatus: string;
  securityTier:   string;
  ownerHandle:    string | null;
  ownerCount:     number;
}

// ── Share dropdown ────────────────────────────────────────────
function ShareMenu({ qrCode, brand, model, posterUrl }: {
  qrCode: string; brand: string; model: string; posterUrl: string | null;
}) {
  const [open,   setOpen]   = useState(false);
  const [copied, setCopied] = useState(false);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://16store-app.vercel.app';
  const link   = `${appUrl}/passport/${qrCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1800);
  };

  const handleSavePoster = () => {
    if (!posterUrl) return;
    const a = document.createElement('a');
    a.href     = posterUrl;
    a.download = `16store-${brand}-${model}-${qrCode}.png`.replace(/\s+/g, '-');
    a.target   = '_blank';
    a.click();
    setOpen(false);
  };

  const handleShareNative = async () => {
    if (!posterUrl) { handleCopy(); return; }
    try {
      const res  = await fetch(posterUrl);
      const blob = await res.blob();
      const file = new File([blob], `16store-${qrCode}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${brand} ${model} · 16Store`, url: link });
        setOpen(false); return;
      }
    } catch {}
    handleCopy();
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display:       'flex',
          alignItems:    'center',
          gap:            6,
          padding:       '7px 16px',
          fontFamily:    'monospace',
          fontSize:       10,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color:         '#C8531C',
          background:    'rgba(200,83,28,0.08)',
          border:        '0.5px solid rgba(200,83,28,0.4)',
          cursor:        'pointer',
          transition:    'all 0.2s',
        }}
      >
        ↗ Chia sẻ
        <span style={{ fontSize: 8, opacity: 0.6 }}>▾</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          {/* Menu */}
          <div style={{
            position:   'absolute',
            top:        '110%',
            right:       0,
            zIndex:      50,
            background: '#0d0d14',
            border:     '0.5px solid rgba(200,83,28,0.3)',
            minWidth:    180,
            boxShadow:  '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            {posterUrl && (
              <button onClick={handleSavePoster} style={menuItemStyle}>
                <span>↓</span> Lưu ảnh poster
              </button>
            )}
            <button onClick={handleCopy} style={menuItemStyle}>
              <span>{copied ? '✓' : '⎘'}</span>
              {copied ? 'Đã copy!' : 'Copy link passport'}
            </button>
            <button onClick={handleShareNative} style={menuItemStyle}>
              <span>↗</span> Chia sẻ lên mạng xã hội
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display:       'flex',
  alignItems:    'center',
  gap:            10,
  width:         '100%',
  padding:       '10px 16px',
  fontFamily:    'monospace',
  fontSize:       11,
  color:         'rgba(255,255,255,0.7)',
  background:    'none',
  border:        'none',
  borderBottom:  '0.5px solid rgba(255,255,255,0.06)',
  cursor:        'pointer',
  textAlign:     'left',
  letterSpacing: '0.08em',
  transition:    'background 0.15s',
};

// ── Poster lightbox ───────────────────────────────────────────
function PosterLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position:       'fixed',
        inset:           0,
        zIndex:          9999,
        background:     'rgba(0,0,0,0.92)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:         16,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: 480, width: '100%' }}>
        <img src={url} alt="Poster" style={{ width: '100%', display: 'block' }} />
        <button
          onClick={onClose}
          style={{
            position:   'absolute',
            top:        -40,
            right:       0,
            background: 'none',
            border:     'none',
            color:      'rgba(255,255,255,0.6)',
            fontSize:    28,
            cursor:     'pointer',
            lineHeight:  1,
          }}
        >✕</button>
      </div>
    </div>
  );
}

// ── Soul Score sweep animation ────────────────────────────────
function SoulScoreDisplay({ score }: { score: number }) {
  const [swept, setSwept] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSwept(true), 800);
    return () => clearTimeout(t);
  }, []);

  const getColor = (s: number) => {
    if (s >= 500) return '#d4af37';
    if (s >= 200) return '#e8a040';
    return '#C8531C';
  };
  const color = getColor(score);

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'flex-start',
      gap:             2,
    }}>
      <div style={{
        fontFamily:    'monospace',
        fontSize:       9,
        color:         'rgba(255,255,255,0.35)',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
      }}>
        Soul Score
      </div>
      <div style={{
        position:      'relative',
        overflow:      'hidden',
        display:       'inline-block',
      }}>
        <div style={{
          fontFamily:    'monospace',
          fontSize:       42,
          fontWeight:     900,
          color,
          lineHeight:     1,
          letterSpacing: '-0.02em',
          textShadow:    `0 0 20px ${color}60, 0 0 40px ${color}30`,
        }}>
          {score}
        </div>
        {/* Sweep light */}
        {swept && (
          <div style={{
            position:   'absolute',
            top:         0,
            left:       '-100%',
            width:      '60%',
            height:     '100%',
            background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
            animation:  'soul-sweep 1.2s ease-out forwards',
            pointerEvents: 'none',
          }} />
        )}
      </div>
      <div style={{
        fontFamily:    'monospace',
        fontSize:       9,
        color:         color + '99',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>
        pts · THE FIRST
      </div>
      <style>{`
        @keyframes soul-sweep {
          0%   { left: -100%; opacity: 0; }
          20%  { opacity: 1; }
          100% { left: 150%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Star rain for Định danh mới ───────────────────────────────
function StarRainButton() {
  const [stars, setStars] = useState<{ id: number; x: number; delay: number; size: number }[]>([]);

  const handleHover = () => {
    setStars(Array.from({ length: 8 }, (_, i) => ({
      id:    Date.now() + i,
      x:     Math.random() * 100,
      delay: Math.random() * 0.4,
      size:  2 + Math.random() * 3,
    })));
  };

  return (
    <a
      href="/identify"
      onMouseEnter={handleHover}
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:             8,
        padding:        '12px 28px',
        fontFamily:     'monospace',
        fontSize:        11,
        letterSpacing:  '0.18em',
        textTransform:  'uppercase',
        color:          'rgba(255,255,255,0.5)',
        background:     'transparent',
        border:         '0.5px solid rgba(255,255,255,0.12)',
        textDecoration: 'none',
        position:       'relative',
        overflow:       'hidden',
        transition:     'all 0.3s',
        width:          '100%',
        maxWidth:        320,
      }}
    >
      {/* Stars */}
      {stars.map(s => (
        <span
          key={s.id}
          style={{
            position:    'absolute',
            left:        `${s.x}%`,
            top:         '-10px',
            width:       s.size,
            height:      s.size,
            borderRadius:'50%',
            background:  '#C8531C',
            opacity:      0,
            animation:   `star-fall 0.8s ease-in ${s.delay}s 1 forwards`,
            pointerEvents:'none',
          }}
        />
      ))}
      <span>✦</span>
      Định danh vật phẩm mới
      <style>{`
        @keyframes star-fall {
          0%   { top: -10px; opacity: 0; }
          20%  { opacity: 0.8; }
          100% { top: 110%; opacity: 0; transform: translateX(${Math.random() > 0.5 ? '' : '-'}20px); }
        }
      `}</style>
    </a>
  );
}

// ── Main component ────────────────────────────────────────────
export function PassportHero({
  qrCode, passportId, brand, model, colorway, objectLabel,
  journeyScore, isOwner, isLost, posterUrl, coverImageUrl,
  identityStatus, securityTier, ownerHandle, ownerCount,
}: Props) {
  const [lightbox, setLightbox] = useState(false);

  const tierColor = securityTier === 'heritage' ? '#b8eaff' : securityTier === 'elite' ? '#d4af37' : '#C8531C';

  return (
    <>
      {lightbox && posterUrl && (
        <PosterLightbox url={posterUrl} onClose={() => setLightbox(false)} />
      )}

      <div style={{ marginBottom: 40, paddingBottom: 32, borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>

        {/* Object label */}
        <div style={{
          fontFamily:    'monospace',
          fontSize:       9,
          color:         '#C8531C',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          display:       'flex',
          alignItems:    'center',
          gap:            8,
          marginBottom:   12,
        }}>
          <span style={{ width: 8, height: 8, background: '#C8531C', display: 'inline-block', flexShrink: 0 }} />
          {objectLabel}
          {isLost && (
            <span style={{
              marginLeft:    8,
              background:    'rgba(239,68,68,0.15)',
              border:        '0.5px solid rgba(239,68,68,0.5)',
              color:         '#ef4444',
              padding:       '1px 8px',
              fontSize:       8,
              letterSpacing: '0.15em',
            }}>
              BỊ MẤT
            </span>
          )}
        </div>

        {/* Brand / Model */}
        <h1 style={{
          fontFamily:    '"Bebas Neue", "Arial Black", sans-serif',
          fontSize:      'clamp(36px, 5vw, 64px)',
          lineHeight:     0.95,
          textTransform: 'uppercase',
          marginBottom:   8,
          letterSpacing: '0.02em',
        }}>
          {brand}<br />
          <span style={{ color: '#C8531C' }}>{model}</span>
        </h1>

        {colorway && (
          <div style={{
            fontFamily:  'Georgia, serif',
            fontStyle:   'italic',
            fontSize:     22,
            color:       'rgba(255,255,255,0.55)',
            marginBottom: 20,
          }}>
            &ldquo;{colorway}&rdquo;
          </div>
        )}

        {/* QR + Soul Score row */}
        <div style={{
          display:     'flex',
          alignItems:  'flex-end',
          gap:          24,
          marginBottom: 20,
          flexWrap:    'wrap',
        }}>
          {/* QR — bigger */}
          <div style={{ flexShrink: 0 }}>
            <QRMiniDisplay
              qrCode={qrCode}
              passportId={isOwner ? passportId : undefined}
              size={96}
            />
          </div>

          {/* Soul Score */}
          <SoulScoreDisplay score={journeyScore} />

          {/* Security + Found badges */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 'auto' }}>
            <span style={{
              fontFamily:    'monospace',
              fontSize:       9,
              color:          tierColor,
              border:        `0.5px solid ${tierColor}40`,
              padding:       '3px 10px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background:    `${tierColor}10`,
            }}>
              {securityTier === 'heritage' ? '⬡ HERITAGE' : securityTier === 'elite' ? '◆ ELITE' : '◎ STANDARD'}
            </span>
            <span style={{
              fontFamily:    'monospace',
              fontSize:       9,
              color:         identityStatus === 'certified' ? '#d4af37' : identityStatus === 'ai_verified' ? '#e8a040' : 'rgba(255,255,255,0.3)',
              border:        '0.5px solid rgba(255,255,255,0.1)',
              padding:       '3px 10px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}>
              {identityStatus === 'certified' ? '✦ CERTIFIED' : identityStatus === 'ai_verified' ? '🤖 AI VERIFIED' : '🔓 GHI NHẬN'}
            </span>
          </div>
        </div>

        {/* Poster thumbnail + Share button row */}
        <div style={{
          display:     'flex',
          alignItems:  'flex-start',
          gap:          16,
          flexWrap:    'wrap',
        }}>
          {/* Poster thumbnail */}
          {posterUrl && (
            <div
              onClick={() => setLightbox(true)}
              style={{
                width:    80,
                cursor:  'pointer',
                position:'relative',
                flexShrink: 0,
              }}
              title="Click để phóng to"
            >
              <img
                src={posterUrl}
                alt="Poster"
                style={{
                  width:      '100%',
                  display:    'block',
                  border:     '0.5px solid rgba(200,83,28,0.3)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              />
              <div style={{
                position:      'absolute',
                bottom:         4,
                left:           0,
                right:          0,
                textAlign:     'center',
                fontFamily:    'monospace',
                fontSize:       6,
                color:         '#C8531C',
                letterSpacing: '0.1em',
                background:    'rgba(0,0,0,0.6)',
                padding:       '2px 0',
              }}>
                POSTER ↗
              </div>
            </div>
          )}

          {/* Share button */}
          <ShareMenu
            qrCode={qrCode}
            brand={brand}
            model={model}
            posterUrl={posterUrl}
          />
        </div>

        {/* Định danh mới — owner only, bottom of section */}
        {isOwner && (
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-start' }}>
            <StarRainButton />
          </div>
        )}
      </div>
    </>
  );
}
