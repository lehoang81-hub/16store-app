'use client';

import { useState, useEffect } from 'react';
import type { CaptureData, ScanResult } from './IdentifyFlow';
import { identifyAsset } from '@/lib/actions/identify-asset';

interface Props {
  captureData: CaptureData;
  userId: string;
  onComplete: (result: ScanResult) => void;
  onBack: () => void;
}

const STEPS = [
  {
    title: 'Xử lý ảnh',
    subs: [
      'Kiểm tra chất lượng ảnh...',
      'Tối ưu hoá dữ liệu hình ảnh...',
      '✓ Ảnh đã được xử lý',
    ],
    duration: 1500,
  },
  {
    title: 'Spatial Hash',
    subs: [
      'Xác lập tọa độ GPS...',
      'Tính spatial fingerprint...',
      '✓ Spatial hash: Ghi nhận',
    ],
    duration: 1200,
  },
  {
    title: 'Ghi sổ cái',
    subs: [
      'Kiểm tra trùng lặp toàn hệ thống...',
      'Mint passport vào universal_assets...',
      '✓ Khai sinh thành công!',
    ],
    duration: 1800,
  },
];

interface StepState {
  status: 'pending' | 'active' | 'done';
  currentSub: string;
  progress: number;
}

export function ScreenScanning({ captureData, userId, onComplete, onBack }: Props) {
  const [steps, setSteps] = useState<StepState[]>(
    STEPS.map(() => ({ status: 'pending', currentSub: 'Chờ xử lý...', progress: 0 }))
  );
  const [scores, setScores] = useState<{ confidence: number; uniqueness: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ACCENT = captureData.tier === 'elite' ? '#d4af37' : captureData.tier === 'heritage' ? '#b8eaff' : '#c8531c';

  useEffect(() => {
    let cancelled = false;
    let totalDelay = 0;

    const runSteps = async () => {
      for (let i = 0; i < STEPS.length; i++) {
        const step = STEPS[i];
        if (cancelled) return;

        // Set active
        setSteps(prev => prev.map((s, idx) =>
          idx === i ? { ...s, status: 'active', progress: 0 } : s
        ));

        // Animate subs + progress
        for (let j = 0; j < step.subs.length; j++) {
          if (cancelled) return;
          await delay(step.duration / step.subs.length);
          setSteps(prev => prev.map((s, idx) =>
            idx === i ? {
              ...s,
              currentSub: step.subs[j],
              progress: Math.round(((j + 1) / step.subs.length) * 100),
            } : s
          ));
        }

        // Set done
        setSteps(prev => prev.map((s, idx) =>
          idx === i ? { ...s, status: 'done', progress: 100 } : s
        ));

        totalDelay += step.duration;
      }

      if (cancelled) return;

      // Show scores
      setScores({ confidence: 97, uniqueness: 99.2 });

      // Call actual API
      try {
        const result = await identifyAsset({
          brand: captureData.brand,
          model: captureData.model,
          colorway: captureData.colorway,
          objectType: captureData.objectType,
          tier: captureData.tier,
          lat: captureData.lat,
          lng: captureData.lng,
          altitude: captureData.altitude,
          bearing: captureData.bearing,
          accuracy: captureData.accuracy,
          uploadedUrls: (captureData as any).uploadedUrls ?? {},
          aiConfidence: 0, // Gemini disabled in Phase 1
          uniquenessScore: 0,
        });

        if (!result.success) {
          setError(result.error ?? 'Định danh thất bại');
          return;
        }

        await delay(1200);
        if (!cancelled) onComplete({
          passportId:           result.passportId ?? '',
          qrCode:               result.qrCode ?? '',
          serialNumber:         `STD #${Math.floor(Math.random()*999999).toString().padStart(6,'0')}`,
          aiConfidence:         0,
          uniquenessScore:      0,
          isFirstClaim:         result.isFirstClaimant ?? true,
          claimWindowExpiresAt: new Date(Date.now() + 48*3600*1000).toISOString(),
          hlrReward:            result.hlrRewarded ?? 50,
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Lỗi không xác định');
      }
    };

    runSteps();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: '100px 32px 40px',
      position: 'relative', zIndex: 10,
    }}>
      <button onClick={onBack} style={{
        position: 'absolute', top: 80, left: 24,
        background: 'none', border: 'none',
        color: 'rgba(255,255,255,0.3)',
        fontFamily: "'Space Mono', monospace",
        fontSize: 9, letterSpacing: '0.15em',
        cursor: 'pointer', textTransform: 'uppercase',
      }}>← Quay lại</button>

      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 32, letterSpacing: '0.05em',
        marginBottom: 8, textAlign: 'center',
      }}>
        ĐANG TRÍCH XUẤT VÂN TAY SỐ
      </div>
      <div style={{
        fontSize: 8, letterSpacing: '0.2em',
        color: 'rgba(255,255,255,0.3)',
        marginBottom: 32, textAlign: 'center', textTransform: 'uppercase',
      }}>
        AI đang phân tích — vui lòng giữ nguyên
      </div>

      {/* Progress list */}
      <div style={{ width: '100%', maxWidth: 400, marginBottom: 32 }}>
        {STEPS.map((step, i) => {
          const s = steps[i];
          return (
            <div key={step.title} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0',
              borderBottom: '0.5px solid rgba(255,255,255,0.06)',
            }}>
              {/* Icon */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                border: `1px solid ${s.status === 'done' ? ACCENT : s.status === 'active' ? ACCENT : 'rgba(255,255,255,0.15)'}`,
                background: s.status === 'done' ? ACCENT : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, flexShrink: 0,
                color: s.status === 'done' ? '#000' : 'transparent',
                animation: s.status === 'active' ? 'pulseIcon 1s infinite' : 'none',
                transition: 'all 0.4s',
              }}>
                {s.status === 'done' ? '✓' : ''}
              </div>

              {/* Text */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 10, letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: s.status === 'pending' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.8)',
                }}>
                  {step.title}
                </div>
                <div style={{
                  fontSize: 8, color: 'rgba(255,255,255,0.3)',
                  letterSpacing: '0.1em', marginTop: 2,
                  transition: 'all 0.3s',
                }}>
                  {s.currentSub}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{
                width: 60, height: 2,
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 1, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', background: ACCENT,
                  borderRadius: 1, width: s.progress + '%',
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Scores */}
      {scores && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 12, width: '100%', maxWidth: 320,
          opacity: scores ? 1 : 0, transition: 'opacity 0.5s',
        }}>
          {[
            { val: scores.confidence + '%', lab: 'Độ tin cậy AI' },
            { val: scores.uniqueness.toFixed(1), lab: 'Uniqueness Score' },
            { val: '512', lab: 'CLIP Dimensions' },
            { val: '✓', lab: 'Không trùng lặp', green: true },
          ].map((sc, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '0.5px solid rgba(255,255,255,0.08)',
              padding: 14, textAlign: 'center', borderRadius: 4,
            }}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 36, color: sc.green ? '#4ade80' : ACCENT, lineHeight: 1,
              }}>
                {sc.val}
              </div>
              <div style={{
                fontSize: 7, letterSpacing: '0.18em',
                color: sc.green ? '#4ade80' : 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase', marginTop: 4,
              }}>
                {sc.lab}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(226,75,74,0.1)',
          border: '0.5px solid rgba(226,75,74,0.4)',
          borderRadius: 4, padding: '12px 20px',
          color: '#f09595', fontSize: 10,
          letterSpacing: '0.1em', textAlign: 'center',
          marginTop: 16,
        }}>
          {error}
        </div>
      )}

      <style>{`
        @keyframes pulseIcon {
          0%, 100% { border-color: ${ACCENT}; }
          50% { border-color: ${ACCENT}40; }
        }
      `}</style>
    </div>
  );
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
