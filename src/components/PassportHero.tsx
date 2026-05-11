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
  const appUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://16store-app.vercel.app';
  const link = `${appUrl}/passport/${qrCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1800);
  };

  const handleSave = () => {
    if (!posterUrl) return;
    const a = document.createElement('a');
    a.href = posterUrl;
    a.download = `16store-${qrCode}.jpg`;
    a.target = '_blank';
    a.click();
    setOpen(false);
  };

  const handleShare = async () => {
    if (posterUrl) {
      try {
        const res  = await fetch(posterUrl);
        const blob = await res.blob();
        const file = new File([blob], `16store-${qrCode}.jpg`, { type: blob.type });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: `${brand} ${model} · 16Store`, url: link });
          setOpen(false); return;
        }
      } catch {}
    }
    handleCopy();
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display:       'inline-flex',
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
          whiteSpace:    'nowrap',
        }}
      >
        ↗ Chia sẻ <span style={{ fontSize: 7, opacity: 0.6 }}>▾</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position:  'absolute',
            top:       '110%',
            left:       0,
            zIndex:     50,
            background:'#0d0d14',
            border:    '0.5px solid rgba(200,83,28,0.3)',
            minWidth:   180,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}>
            {posterUrl && (
              <button onClick={handleSave} style={menuItem}>
                ↓ Lưu ảnh poster
              </button>
            )}
            <button onClick={handleCopy} style={menuItem}>
              {copied ? '✓ Đã copy!' : '⎘ Copy link passport'}
            </button>
            <button onClick={handleShare} style={menuItem}>
              ↗ Chia sẻ lên mạng xã hội
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const menuItem: React.CSSProperties = {
  display:       'block',
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
};

// ── Poster lightbox ───────────────────────────────────────────
function PosterLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: 480, width: '100%' }}>
        <img src={url} alt="Poster" style={{ width: '100%', display: 'block' }} />
        <button onClick={onClose} style={{
          position: 'absolute', top: -40, right: 0,
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.7)', fontSize: 28,
          cursor: 'pointer',
        }}>✕</button>
      </div>
    </div>
  );
}

// ── Soul Score with sweep ─────────────────────────────────────
function SoulScore({ score }: { score: number }) {
  const [swept, setSwept] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSwept(true), 600); return () => clearTimeout(t); }, []);

  const color = score >= 500 ? '#d4af37' : score >= 200 ? '#e8a040' : '#C8531C';

  return (
    <div>
      <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 4 }}>
        Soul Score
      </div>
      <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
        <span style={{
          fontFamily:  'monospace',
          fontSize:     44,
          fontWeight:   900,
          color,
          lineHeight:   1,
          textShadow:  `0 0 20px ${color}50`,
        }}>
          {score}
        </span>
        {swept && (
          <span style={{
            position:   'absolute',
            top: 0, bottom: 0,
            left:       '-100%',
            width:      '50%',
            background: `linear-gradient(90deg, transparent, ${color}50, transparent)`,
            animation:  'sweep 1s ease-out forwards',
            pointerEvents: 'none',
          }} />
        )}
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 9, color: color + '80', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
        pts · THE FIRST
      </div>
      <style>{`@keyframes sweep { 0%{left:-100%} 100%{left:160%} }`}</style>
    </div>
  );
}

// ── Star rain button ──────────────────────────────────────────
function StarRainButton() {
  const [stars, setStars] = useState<{ id: number; x: number; d: number; s: number }[]>([]);

  return (
    <a
      href="/identify"
      onMouseEnter={() => setStars(
        Array.from({ length: 10 }, (_, i) => ({ id: Date.now() + i, x: Math.random() * 100, d: Math.random() * 0.5, s: 2 + Math.random() * 3 }))
      )}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:             8,
        padding:        '10px 24px',
        fontFamily:     'monospace',
        fontSize:        10,
        letterSpacing:  '0.16em',
        textTransform:  'uppercase',
        color:          'rgba(255,255,255,0.45)',
        background:     'transparent',
        border:         '0.5px solid rgba(255,255,255,0.1)',
        textDecoration: 'none',
        position:       'relative',
        overflow:       'hidden',
        transition:     'border-color 0.3s, color 0.3s',
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)';
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
      }}
    >
      {stars.map(s => (
        <span key={s.id} style={{
          position:     'absolute',
          left:         `${s.x}%`,
          top:          '-8px',
          width:         s.s,
          height:        s.s,
          borderRadius: '50%',
          background:   '#C8531C',
          opacity:       0,
          animation:    `starfall 0.7s ease-in ${s.d}s 1 forwards`,
          pointerEvents:'none',
        }} />
      ))}
      ✦ Định danh vật phẩm mới
      <style>{`@keyframes starfall { 0%{top:-8px;opacity:0} 20%{opacity:0.8} 100%{top:110%;opacity:0} }`}</style>
    </a>
  );
}

// ── Main ──────────────────────────────────────────────────────
export function PassportHero({
  qrCode, passportId, brand, model, colorway, objectLabel,
  journeyScore, isOwner, isLost, posterUrl, identityStatus, securityTier,
}: Props) {
  const [lightbox, setLightbox] = useState(false);
  const [posterErr, setPosterErr] = useState(false);

  const tierColor = securityTier === 'heritage' ? '#b8eaff' : securityTier === 'elite' ? '#d4af37' : '#C8531C';
  const tierLabel = securityTier === 'heritage' ? '⬡ HERITAGE' : securityTier === 'elite' ? '◆ ELITE' : '◎ STANDARD';
  const statusColor = identityStatus === 'certified' ? '#d4af37' : identityStatus === 'ai_verified' ? '#e8a040' : 'rgba(255,255,255,0.25)';
  const statusLabel = identityStatus === 'certified' ? '✦ CERTIFIED' : identityStatus === 'ai_verified' ? '🤖 AI VERIFIED' : '🔓 GHI NHẬN';

  const showPoster = posterUrl && !posterErr;

  return (
    <>
      {lightbox && posterUrl && <PosterLightbox url={posterUrl} onClose={() => setLightbox(false)} />}

      <div style={{ marginBottom: 40, paddingBottom: 28, borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>

        {/* Object label */}
        <div style={{
          fontFamily: 'monospace', fontSize: 9, color: '#C8531C',
          letterSpacing: '0.22em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
        }}>
          <span style={{ width: 8, height: 8, background: '#C8531C', display: 'inline-block', flexShrink: 0 }} />
          {objectLabel}
          {isLost && (
            <span style={{ background: 'rgba(239,68,68,0.15)', border: '0.5px solid rgba(239,68,68,0.5)', color: '#ef4444', padding: '1px 8px', fontSize: 8, letterSpacing: '0.15em' }}>
              BỊ MẤT
            </span>
          )}
        </div>

        {/* Brand / Model */}
        <h1 style={{
          fontFamily: '"Bebas Neue","Arial Black",sans-serif',
          fontSize: 'clamp(36px,5vw,64px)',
          lineHeight: 0.95, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.02em',
        }}>
          {brand}<br />
          <span style={{ color: '#C8531C' }}>{model}</span>
        </h1>

        {colorway && (
          <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: 22, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
            &ldquo;{colorway}&rdquo;
          </div>
        )}

        {/* Row: QR + Soul Score + Badges */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
          {/* QR */}
          <QRMiniDisplay qrCode={qrCode} passportId={isOwner ? passportId : undefined} size={96} />

          {/* Soul Score */}
          <SoulScore score={journeyScore} />

          {/* Badges — pushed right */}
          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <span style={{
              fontFamily: 'monospace', fontSize: 9, color: tierColor,
              border: `0.5px solid ${tierColor}40`, padding: '3px 10px',
              letterSpacing: '0.12em', textTransform: 'uppercase', background: `${tierColor}10`,
              whiteSpace: 'nowrap',
            }}>
              {tierLabel}
            </span>
            <span style={{
              fontFamily: 'monospace', fontSize: 9, color: statusColor,
              border: '0.5px solid rgba(255,255,255,0.1)', padding: '3px 10px',
              letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Row: Poster thumbnail + Share */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isOwner ? 16 : 0, flexWrap: 'wrap' }}>
          {showPoster && (
            <div
              onClick={() => setLightbox(true)}
              title="Click để phóng to"
              style={{ width: 64, flexShrink: 0, cursor: 'pointer', position: 'relative' }}
            >
              <img
                src={posterUrl}
                alt="Poster"
                onError={() => setPosterErr(true)}
                style={{ width: '100%', display: 'block', border: '0.5px solid rgba(200,83,28,0.3)' }}
              />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                textAlign: 'center', fontFamily: 'monospace', fontSize: 6,
                color: '#C8531C', background: 'rgba(0,0,0,0.65)', padding: '2px 0',
                letterSpacing: '0.08em',
              }}>
                POSTER ↗
              </div>
            </div>
          )}

          <ShareMenu qrCode={qrCode} brand={brand} model={model} posterUrl={showPoster ? posterUrl : null} />
        </div>

        {/* Định danh mới — owner only */}
        {isOwner && <StarRainButton />}
      </div>
    </>
  );
}
