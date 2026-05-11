'use client';

import { useState } from 'react';
import { PosterCanvas } from '@/components/PosterCanvas';

interface Props {
  qrCode:       string;
  brand:        string;
  model:        string;
  colorway?:    string;
  heroUrl?:     string;
  ownerHandle?: string;
  ownerCount?:  number;
  soulScore?:   number;
}

export function IdentityPosterButton({ qrCode, brand, model, colorway, heroUrl, ownerHandle, ownerCount, soulScore }: Props) {
  const [open,     setOpen]     = useState(false);
  const [dataUrl,  setDataUrl]  = useState<string | null>(null);
  const [concept,     setConcept]     = useState<'archive' | 'lifestyle' | 'emotional'>('archive');
  const [shareCopied, setShareCopied] = useState(false);

  const handleSave = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href     = dataUrl;
    a.download = `16store-passport-${qrCode}.png`;
    a.click();
  };

  const handleShare = async () => {
    if (!dataUrl) return;

    // Try native file share (mobile / supported browsers)
    try {
      const res  = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `16store-passport-${qrCode}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${brand} ${model} · 16Store Passport` });
        return;
      }
    } catch {}

    // Fallback: download ảnh + copy link (Windows desktop)
    const link = `https://16store.app/p/${qrCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      prompt('Copy link passport:', link);
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          fontFamily:    "'Space Mono',monospace",
          fontSize:      9,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color:         'rgba(255,255,255,0.5)',
          background:    'transparent',
          border:        '0.5px solid rgba(255,255,255,0.15)',
          borderRadius:  2,
          padding:       '4px 10px',
          cursor:        'pointer',
          transition:    'all 0.2s',
        }}
        onMouseEnter={e => {
          (e.target as HTMLElement).style.color  = '#C8531C';
          (e.target as HTMLElement).style.borderColor = '#C8531C';
        }}
        onMouseLeave={e => {
          (e.target as HTMLElement).style.color  = 'rgba(255,255,255,0.5)';
          (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)';
        }}
      >
        ↗ Poster
      </button>

      {/* Modal */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position:   'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.88)',
            display:    'flex', alignItems: 'center', justifyContent: 'center',
            padding:    '24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0a0a0f',
              border:     '0.5px solid rgba(200,83,28,0.3)',
              borderRadius: 4,
              padding:    24,
              width:      '100%',
              maxWidth:   480,
              maxHeight:  '90vh',
              overflowY:  'auto',
              display:    'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{
                fontFamily: "'Space Mono',monospace",
                fontSize: 10, letterSpacing: '0.2em',
                textTransform: 'uppercase', color: '#C8531C',
              }}>
                ✦ Poster Định danh
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                  fontFamily: "'Space Mono',monospace", fontSize: 14,
                }}
              >✕</button>
            </div>

            {/* Concept selector */}
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { id: 'archive',   label: 'Archive',   color: '#C8531C' },
                { id: 'lifestyle', label: 'Lifestyle', color: '#d4af37' },
                { id: 'emotional', label: 'Memory',    color: '#5DCAA5' },
              ] as const).map(c => (
                <button
                  key={c.id}
                  onClick={() => { setConcept(c.id); setDataUrl(null); }}
                  style={{
                    flex: 1, padding: '6px',
                    fontFamily: "'Space Mono',monospace",
                    fontSize: 9, letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    border: `0.5px solid ${concept === c.id ? c.color : 'rgba(255,255,255,0.1)'}`,
                    background: concept === c.id ? `${c.color}15` : 'transparent',
                    color: concept === c.id ? c.color : 'rgba(255,255,255,0.4)',
                    cursor: 'pointer', transition: 'all 0.2s',
                    borderRadius: 2,
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Canvas poster */}
            <PosterCanvas
              key={concept}
              concept={concept}
              data={{
                brand, model, colorway, qrCode,
                heroUrl:     heroUrl ?? '',
                ownerHandle: ownerHandle,
                ownerCount:  ownerCount,
                soulScore:   soulScore,
                variant:     'identity',
              }}
              onReady={setDataUrl}
            />

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleSave}
                disabled={!dataUrl}
                style={{
                  flex: 1, padding: '10px',
                  fontFamily: "'Space Mono',monospace",
                  fontSize: 10, letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  background: dataUrl ? '#C8531C' : 'transparent',
                  color: dataUrl ? '#fff' : 'rgba(255,255,255,0.2)',
                  border: `0.5px solid ${dataUrl ? '#C8531C' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 2, cursor: dataUrl ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                ↓ Lưu PNG
              </button>
              <button
                onClick={handleShare}
                disabled={!dataUrl}
                style={{
                  flex: 1, padding: '10px',
                  fontFamily: "'Space Mono',monospace",
                  fontSize: 10, letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  background: 'transparent',
                  color: dataUrl ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
                  border: `0.5px solid ${dataUrl ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 2, cursor: dataUrl ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                {shareCopied ? '✓ Đã copy link!' : '↗ Chia sẻ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
