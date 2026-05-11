'use client';

import { useState, useEffect } from 'react';
import type { IdentifyTier } from './IdentifyFlow';

interface Props {
  stats: { total: number; today: number; openWindows: number };
  onStart: (tier: IdentifyTier) => void;
}

const TIERS: { id: IdentifyTier; label: string; desc: string; price: string; features: string[] }[] = [
  {
    id: 'standard',
    label: 'STANDARD',
    desc: 'Phổ thông',
    price: 'Miễn phí',
    features: ['Image Hash', 'Gemini Vision', 'GPS Spatial', 'QR Passport'],
  },
  {
    id: 'elite',
    label: 'ELITE',
    desc: 'Cao cấp',
    price: '49,000 VNĐ',
    features: ['CLIP Vector 512d', 'Cosine Matching', 'Anti-fraud AI', 'Gold Badge'],
  },
  {
    id: 'heritage',
    label: 'HERITAGE',
    desc: 'Di sản',
    price: '499,000 VNĐ',
    features: ['Point Cloud', 'VPS Spatial', 'Holographic QR', 'Blockchain TS'],
  },
];

export function ScreenWelcome({ stats, onStart }: Props) {
  const [liveTotal, setLiveTotal] = useState(stats.total);
  const [selectedTier, setSelectedTier] = useState<IdentifyTier>('standard');

  // Live counter tăng dần
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setLiveTotal(n => n + 1);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: '100px 32px 40px',
      position: 'relative', zIndex: 10,
    }}>

      {/* Live counter */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 72, lineHeight: 1,
          color: '#c8531c', letterSpacing: '0.02em',
          transition: 'all 0.3s',
        }}>
          {liveTotal.toLocaleString()}
        </div>
        <div style={{
          fontSize: 8, letterSpacing: '0.25em',
          color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase',
          marginTop: 4,
        }}>
          Vật phẩm đã được khai sinh vào vũ trụ
        </div>
      </div>

      {/* Hero text */}
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 56, textAlign: 'center',
        lineHeight: 0.95, marginBottom: 12,
        letterSpacing: '0.02em',
      }}>
        GHI DẤU<br />
        <span style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 48, fontStyle: 'italic',
          color: '#c8531c',
        }}>
          di sản
        </span>
        <br />CỦA BẠN
      </div>

      <div style={{
        fontSize: 10, letterSpacing: '0.2em',
        color: 'rgba(255,255,255,0.35)', textAlign: 'center',
        marginBottom: 40, lineHeight: 1.8, textTransform: 'uppercase',
      }}>
        Mỗi vật phẩm là một câu chuyện<br />
        Mỗi câu chuyện xứng đáng được bất tử
      </div>

      {/* Tier selector */}
      <div style={{ width: '100%', maxWidth: 560, marginBottom: 32 }}>
        <div style={{
          fontSize: 8, letterSpacing: '0.25em',
          color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase',
          textAlign: 'center', marginBottom: 16,
        }}>
          Chọn cấp độ định danh
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {TIERS.map(tier => (
            <button
              key={tier.id}
              onClick={() => setSelectedTier(tier.id)}
              style={{
                background: selectedTier === tier.id
                  ? 'rgba(200,83,28,0.1)'
                  : 'rgba(255,255,255,0.02)',
                border: `1px solid ${selectedTier === tier.id ? '#c8531c' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 4,
                padding: '16px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
            >
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 10, letterSpacing: '0.2em',
                color: selectedTier === tier.id ? '#c8531c' : 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase', marginBottom: 4,
              }}>
                {tier.label}
              </div>
              <div style={{
                fontSize: 8, color: 'rgba(255,255,255,0.3)',
                letterSpacing: '0.1em', marginBottom: 12,
              }}>
                {tier.desc}
              </div>
              {tier.features.map(f => (
                <div key={f} style={{
                  fontSize: 8, color: 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.08em', marginBottom: 3,
                  display: 'flex', gap: 6, alignItems: 'center',
                }}>
                  <span style={{ color: '#c8531c', fontSize: 8 }}>·</span>
                  {f}
                </div>
              ))}
              <div style={{
                marginTop: 12, fontSize: 9,
                color: selectedTier === tier.id ? '#c8531c' : 'rgba(255,255,255,0.35)',
                fontWeight: 700, letterSpacing: '0.1em',
              }}>
                {tier.price}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => onStart(selectedTier)}
        style={{
          padding: '16px 48px',
          background: '#c8531c', color: '#fff',
          border: 'none', borderRadius: 2,
          fontFamily: "'Space Mono', monospace",
          fontSize: 11, letterSpacing: '0.25em',
          textTransform: 'uppercase', cursor: 'pointer',
          marginBottom: 32,
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#d4641e')}
        onMouseLeave={e => (e.currentTarget.style.background = '#c8531c')}
      >
        BẮT ĐẦU NGHI THỨC ĐỊNH DANH
      </button>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 32 }}>
        {[
          { val: stats.today, lab: 'Định danh hôm nay' },
          { val: stats.openWindows, lab: 'The First còn mở' },
          { val: 3, lab: 'Tiers định danh' },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            {i > 0 && <div style={{ width: 0.5, height: 36, background: 'rgba(255,255,255,0.1)' }} />}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 24, color: 'rgba(255,255,255,0.6)',
              }}>
                {s.val}
              </div>
              <div style={{
                fontSize: 7, letterSpacing: '0.2em',
                color: 'rgba(255,255,255,0.25)',
                textTransform: 'uppercase', marginTop: 2,
              }}>
                {s.lab}
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
