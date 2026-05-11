'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  reservedUntil: string;
  orderId:       string;
}

export function PaymentTimer({ reservedUntil, orderId }: Props) {
  const router = useRouter();
  const [seconds, setSeconds] = useState(() => {
    const diff = new Date(reservedUntil).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  });

  useEffect(() => {
    if (seconds <= 0) return;
    const interval = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(interval);
          // Reload để server nhận biết hết hạn
          router.refresh();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const pct  = Math.max(0, (seconds / (30 * 60)) * 100);
  const color = seconds < 300 ? '#ef4444' : seconds < 600 ? '#f59e0b' : '#C8531C';

  if (seconds <= 0) return null;

  return (
    <div style={{ marginBottom: 24, padding: '14px 16px', background: 'rgba(200,83,28,0.06)', border: `0.5px solid ${color}40` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Thời gian giữ chỗ
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color, letterSpacing: '0.05em' }}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
      </div>
      {/* Progress bar */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 1, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 1s linear, background 0.3s' }} />
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 6, letterSpacing: '0.08em' }}>
        Vật phẩm được giữ cho bạn trong thời gian này
      </div>
    </div>
  );
}
