'use client';

import { useState, useEffect } from 'react';
import { CertifyButton } from '@/components/CertifyButton';

type IdentityStatus = 'unverified' | 'temp_claimed' | 'ai_verified' | 'certified';

interface Props {
  status:      IdentityStatus;
  isOwner?:    boolean;
  passportId?: string;
  qrCode?:     string;
  compact?:    boolean;
}

const TIERS = [
  {
    key:      'temp_claimed' as IdentityStatus,
    label:    'Ghi Nhận',
    fullLabel:'Đã Ghi Nhận',
    sublabel: 'Self-declared',
    icon:     '🔓',
    color:    '#C8531C',
    glow:     'rgba(200,83,28,0.2)',
    perks: [
      'Lưu trữ & xem cá nhân',
      'Viết nhật ký hành trình',
      'Cho mượn vật phẩm',
      'Chia sẻ passport link',
    ],
    locked: [
      'Ký gửi bán trên 16Store',
      'Affiliate commission link',
      'Soul Score bonus',
    ],
    note: 'Mức cơ bản — vật phẩm đã được ghi nhận vào hệ thống nhưng chưa qua xác thực.',
    cta:  null,
  },
  {
    key:      'ai_verified' as IdentityStatus,
    label:    'AI Xác Thực',
    fullLabel:'AI Xác Thực',
    sublabel: 'Gemini Vision',
    icon:     '🤖',
    color:    '#e8a040',
    glow:     'rgba(232,160,64,0.2)',
    perks: [
      'Tất cả quyền lợi Tier 1',
      'Ký gửi bán (giá < 5 triệu)',
      'Affiliate commission link',
      '+15% Soul Score bonus',
      'Badge AI trên listing',
    ],
    locked: [
      'Ký gửi hàng giá trị cao (>5tr)',
      'Priority listing vị trí đầu',
    ],
    note: 'AI Gemini Vision so sánh ảnh vật phẩm với dữ liệu gốc. Nhanh, tự động, không cần di chuyển.',
    cta:  'Sprint 5 — Sắp ra mắt',
  },
  {
    key:      'certified' as IdentityStatus,
    label:    'Chứng Nhận',
    fullLabel:'16Store Xác Thực',
    sublabel: 'Hub Certified',
    icon:     '✦',
    color:    '#d4af37',
    glow:     'rgba(212,175,55,0.25)',
    perks: [
      'Tất cả quyền lợi Tier 1 & 2',
      'Ký gửi mọi giá trị',
      'Priority listing vị trí đầu',
      'Trust badge vĩnh viễn',
      'Khóa thông tin — chống giả mạo',
      'Hỗ trợ tranh chấp từ 16Store',
    ],
    locked: [],
    note: 'Nhân viên Hub kiểm tra vật lý và xác nhận. Mức tin cậy cao nhất — dành cho hàng giá trị cao.',
    cta:  'Mang đến Hub gần nhất',
  },
];

function getTierIndex(status: IdentityStatus): number {
  if (status === 'certified')    return 2;
  if (status === 'ai_verified')  return 1;
  if (status === 'temp_claimed') return 0;
  return -1;
}

function ScanLine({ color }: { color: string }) {
  return (
    <span style={{
      position:      'absolute',
      left: 0, right: 0,
      height:         2,
      background:    `linear-gradient(90deg, transparent, ${color}cc, transparent)`,
      animation:     'tier-scan 2s ease-in-out infinite',
      pointerEvents: 'none',
    }} />
  );
}

function GlowPulse({ color }: { color: string }) {
  return (
    <span style={{
      position:      'absolute',
      inset:          -2,
      border:        `1px solid ${color}60`,
      animation:     'tier-glow 2s ease-in-out infinite',
      pointerEvents: 'none',
    }} />
  );
}

function TierPopup({ tier, isActive, isDone, onClose }: {
  tier: typeof TIERS[0]; isActive: boolean; isDone: boolean; onClose: () => void;
}) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#0d0d14',
        border: `1px solid ${tier.color}40`,
        borderTop: `2px solid ${tier.color}`,
        maxWidth: 420, width: '100%', padding: 28, position: 'relative',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 14,
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18,
        }}>✕</button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 28, filter: `drop-shadow(0 0 10px ${tier.color})` }}>{tier.icon}</span>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: tier.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {tier.fullLabel}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              {tier.sublabel}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            {isDone   && <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6ec070', border: '0.5px solid #6ec07060', padding: '3px 10px' }}>✓ ĐÃ ĐẠT</span>}
            {isActive && <span style={{ fontFamily: 'monospace', fontSize: 10, color: tier.color, border: `0.5px solid ${tier.color}60`, padding: '3px 10px' }}>● HIỆN TẠI</span>}
            {!isDone && !isActive && <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.2)', border: '0.5px dashed rgba(255,255,255,0.12)', padding: '3px 10px' }}>CHƯA ĐẠT</span>}
          </div>
        </div>

        <p style={{ fontFamily: 'Georgia,serif', fontSize: 13, fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: '16px 0', paddingBottom: 16, borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          {tier.note}
        </p>

        {/* Perks */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>Quyền lợi</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {tier.perks.map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: tier.color + '20', border: `0.5px solid ${tier.color}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: tier.color, flexShrink: 0 }}>✓</span>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Locked */}
        {tier.locked.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>Chưa mở ở tier này</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {tier.locked.map(p => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>⊘</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'rgba(255,255,255,0.22)' }}>{p}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tier.cta && (
          <div style={{ paddingTop: 14, borderTop: '0.5px solid rgba(255,255,255,0.07)', fontFamily: 'monospace', fontSize: 12, color: tier.color + '80', letterSpacing: '0.1em' }}>
            → {tier.cta}
          </div>
        )}
      </div>
    </div>
  );
}

export function IdentityTierBadge({ status, isOwner, passportId, qrCode, compact }: Props) {
  const [popupTier, setPopupTier] = useState<number | null>(null);
  const [mounted,   setMounted]   = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const tierIdx    = getTierIndex(status);
  const activeTier = TIERS[Math.max(tierIdx, 0)];
  const isUnverified = tierIdx === -1;

  if (compact) {
    return (
      <>
        <style>{KEYFRAMES}</style>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', border: `0.5px ${status === 'temp_claimed' || isUnverified ? 'dashed' : 'solid'} ${isUnverified ? 'rgba(255,255,255,0.2)' : activeTier.color}`, background: isUnverified ? 'transparent' : activeTier.glow, position: 'relative', overflow: 'hidden' }}>
          {status === 'ai_verified' && mounted && <ScanLine color={activeTier.color} />}
          {status === 'certified'   && mounted && <GlowPulse color={activeTier.color} />}
          <span style={{ fontSize: 13 }}>{isUnverified ? '🔓' : activeTier.icon}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: isUnverified ? 'rgba(255,255,255,0.3)' : activeTier.color }}>
            {isUnverified ? 'Chưa định danh' : activeTier.fullLabel}
          </span>
        </span>
      </>
    );
  }

  return (
    <>
      <style>{KEYFRAMES}</style>

      {popupTier !== null && (
        <TierPopup
          tier={TIERS[popupTier]}
          isActive={popupTier === tierIdx}
          isDone={popupTier < tierIdx}
          onClose={() => setPopupTier(null)}
        />
      )}

      <div style={{ background: '#0a0a0f', border: '0.5px solid rgba(200,83,28,0.2)', padding: '24px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: `radial-gradient(circle, ${activeTier.glow} 0%, transparent 70%)`, pointerEvents: 'none' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(200,83,28,0.7)' }}>
            Danh phận vật phẩm
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 18px', border: `0.5px ${status === 'temp_claimed' || isUnverified ? 'dashed' : 'solid'} ${isUnverified ? 'rgba(255,255,255,0.2)' : activeTier.color}`, background: isUnverified ? 'transparent' : activeTier.glow, position: 'relative', overflow: 'hidden' }}>
            {status === 'ai_verified' && mounted && <ScanLine color={activeTier.color} />}
            {status === 'certified'   && mounted && <GlowPulse color={activeTier.color} />}
            <span style={{ fontSize: 15 }}>{isUnverified ? '🔓' : activeTier.icon}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: isUnverified ? 'rgba(255,255,255,0.3)' : activeTier.color }}>
              {isUnverified ? 'Chưa định danh' : activeTier.fullLabel}
            </span>
          </span>
        </div>

        {/* 3 Nodes */}
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 24 }}>
          {TIERS.map((tier, i) => {
            const isActive = i === tierIdx;
            const isDone   = i < tierIdx;
            const nodeColor = isDone ? '#C8531C' : isActive ? activeTier.color : 'rgba(255,255,255,0.15)';

            return (
              <div key={tier.key} style={{ display: 'flex', alignItems: 'flex-start', flex: i < 2 ? 1 : 'none' }}>
                <button
                  onClick={() => setPopupTier(i)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                >
                  <div style={{
                    width: isActive ? 56 : 44, height: isActive ? 56 : 44,
                    borderRadius: '50%',
                    border: `${isActive ? 2 : 1}px ${isDone || isActive ? 'solid' : 'dashed'} ${nodeColor}`,
                    background: isDone ? 'rgba(200,83,28,0.15)' : isActive ? activeTier.glow : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isActive ? 24 : 18,
                    boxShadow: isActive ? `0 0 24px ${activeTier.glow}, 0 0 48px ${activeTier.glow}` : 'none',
                    animation: isActive && status === 'certified' ? 'tier-node-glow 2s ease-in-out infinite' : 'none',
                    position: 'relative', overflow: 'hidden', transition: 'all 0.3s',
                  }}>
                    {isDone ? '✓' : tier.icon}
                    {isActive && status === 'ai_verified' && mounted && <ScanLine color={tier.color} />}
                  </div>
                  <div style={{ textAlign: 'center', minWidth: 72 }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: isActive ? 700 : 400, letterSpacing: '0.08em', textTransform: 'uppercase', color: isDone ? 'rgba(200,83,28,0.7)' : isActive ? activeTier.color : 'rgba(255,255,255,0.25)', marginBottom: 3 }}>
                      {tier.label}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em' }}>
                      {tier.sublabel}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 9, color: nodeColor, opacity: 0.5, marginTop: 5, letterSpacing: '0.08em' }}>
                      tap để xem →
                    </div>
                  </div>
                </button>

                {i < 2 && (
                  <div style={{ flex: 1, height: 1, marginTop: isActive ? 28 : 22, background: i < tierIdx ? 'rgba(200,83,28,0.5)' : 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
                    {i === tierIdx && status !== 'certified' && (
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '40%', height: '100%', background: `linear-gradient(90deg, ${activeTier.color}, transparent)`, animation: 'tier-progress 1.8s ease-in-out infinite' }} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Perks summary */}
        {!isUnverified && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingTop: 16, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
            {activeTier.perks.map(p => (
              <span key={p} style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: activeTier.color, fontSize: 9 }}>✓</span>{p}
              </span>
            ))}
            {activeTier.locked.slice(0, 2).map(p => (
              <span key={p} style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 9 }}>⊘</span>{p}
              </span>
            ))}
          </div>
        )}

        {isUnverified && (
          <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>
            Vật phẩm chưa có danh phận · Bấm định danh để bắt đầu
          </div>
        )}

        {isOwner && !isUnverified && status !== 'certified' && passportId && qrCode && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
            {status === 'temp_claimed' && (
              <CertifyButton passportId={passportId} qrCode={qrCode} />
            )}
            {status === 'ai_verified' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                  → Mang đến Hub để nhận chứng nhận chính thức
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#d4af3780', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Xem Hub →
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

const KEYFRAMES = `
  @keyframes tier-scan {
    0%   { top: -2px; opacity: 0; }
    15%  { opacity: 1; }
    85%  { opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes tier-glow {
    0%, 100% { opacity: 0.3; }
    50%       { opacity: 0.9; }
  }
  @keyframes tier-node-glow {
    0%, 100% { box-shadow: 0 0 12px rgba(212,175,55,0.3), 0 0 24px rgba(212,175,55,0.15); }
    50%       { box-shadow: 0 0 28px rgba(212,175,55,0.6), 0 0 56px rgba(212,175,55,0.3); }
  }
  @keyframes tier-progress {
    0%   { transform: translateX(-100%); opacity: 0.8; }
    100% { transform: translateX(350%); opacity: 0; }
  }
`;
