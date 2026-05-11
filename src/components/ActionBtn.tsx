'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface ActionBtnProps {
  label: string;
  icon: string;
  active?: boolean;
  danger?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  accentColor?: string;
  fullWidth?: boolean;
}

const AMBER = '#C8531C';
const RED   = '#ef4444';

export function ActionBtn({
  label, icon, active, danger, loading, disabled, onClick,
  accentColor, fullWidth,
}: ActionBtnProps) {
  const btnRef    = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const pidRef    = useRef(0);
  const particlesRef = useRef<{
    id: number; x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number; size: number;
  }[]>([]);

  const [hovered, setHovered] = useState(false);
  const [sweepX,  setSweepX]  = useState<number | null>(null);

  const accent     = accentColor ?? (danger ? RED : AMBER);
  const accentGlow = `${accent}55`;
  const isActive   = !!(active && !loading && !disabled);

  // ── Canvas particle loop ─────────────────────────────────
  const drawLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const btn    = btnRef.current;
    if (!canvas || !btn) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== btn.offsetWidth || canvas.height !== btn.offsetHeight) {
      canvas.width  = btn.offsetWidth;
      canvas.height = btn.offsetHeight;
    }

    const cx = canvas.width  / 2;
    const cy = canvas.height / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Spawn particles
    if ((isActive || hovered) && !disabled && !loading) {
      const count = isActive ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist  = (isActive ? 35 : 22) + Math.random() * 25;
        const px    = cx + Math.cos(angle) * dist;
        const py    = cy + Math.sin(angle) * dist;
        particlesRef.current.push({
          id: ++pidRef.current,
          x: px, y: py,
          vx: (cx - px) * 0.06,
          vy: (cy - py) * 0.06,
          life: 0,
          maxLife: 22 + Math.random() * 18,
          size: 1.5 + Math.random() * 2,
        });
      }
    }

    // Draw + update
    particlesRef.current = particlesRef.current.filter(p => p.life < p.maxLife);
    for (const p of particlesRef.current) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life++;
      const t = p.life / p.maxLife;
      const alpha = (1 - t) * 0.9;
      const size  = p.size * (1 - t * 0.4);
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle   = accent;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = accent;
      ctx.shadowBlur  = 8;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;

    animRef.current = requestAnimationFrame(drawLoop);
  }, [isActive, hovered, accent, disabled, loading]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(drawLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [drawLoop]);

  useEffect(() => {
    if (!isActive && !hovered) {
      const t = setTimeout(() => { particlesRef.current = []; }, 700);
      return () => clearTimeout(t);
    }
  }, [isActive, hovered]);

  // ── Hover: Light Sweep ────────────────────────────────────
  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    let f = 0;
    const run = () => {
      f++;
      setSweepX(-100 + (f / 18) * 220);
      if (f < 18) requestAnimationFrame(run);
      else setSweepX(null);
    };
    requestAnimationFrame(run);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    setSweepX(null);
  }, []);

  // ── Click: Burst particles ────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const dist  = 30 + Math.random() * 30;
        const px    = mx + Math.cos(angle) * dist;
        const py    = my + Math.sin(angle) * dist;
        particlesRef.current.push({
          id: ++pidRef.current,
          x: px, y: py,
          vx: (cx - px) * 0.08,
          vy: (cy - py) * 0.08,
          life: 0, maxLife: 28,
          size: 2 + Math.random() * 1.5,
        });
      }
    }
    onClick();
  }, [disabled, loading, onClick]);

  // ── Styles ────────────────────────────────────────────────
  const textColor = isActive ? accent
                 : disabled  ? 'rgba(255,255,255,0.2)'
                 : hovered   ? accent
                 : danger    ? `${RED}99`
                 : 'rgba(255,255,255,0.75)';

  const borderColor = isActive ? accent
                    : disabled ? 'rgba(255,255,255,0.06)'
                    : hovered  ? `${accent}bb`
                    : danger   ? `${RED}55`
                    : 'rgba(255,255,255,0.12)';

  return (
    <button
      ref={btnRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      disabled={disabled || loading}
      style={{
        position:       'relative',
        overflow:       'hidden',
        display:        'inline-flex',
        alignItems:     'center',
        gap:            8,
        width:          fullWidth ? '100%' : 'auto',
        justifyContent: fullWidth ? 'center' : 'flex-start',
        padding:        '11px 20px',
        background:     isActive ? `${accent}12` : 'rgba(255,255,255,0.03)',
        border:         `1px solid ${borderColor}`,
        borderRadius:   2,
        color:          textColor,
        fontFamily:     "'Space Mono', monospace",
        fontSize:       10,
        fontWeight:     700,
        letterSpacing:  '0.2em',
        textTransform:  'uppercase',
        cursor:         disabled || loading ? 'not-allowed' : 'pointer',
        opacity:        disabled ? 0.35 : 1,
        transition:     'color 0.25s, border-color 0.25s, background 0.25s, box-shadow 0.25s',
        boxShadow:      isActive
          ? `0 0 16px ${accentGlow}, inset 0 0 12px ${accentGlow}`
          : hovered
          ? `0 0 10px ${accentGlow}`
          : 'none',
        userSelect:     'none',
        whiteSpace:     'nowrap',
      }}
    >
      {/* Particle canvas */}
      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Border Flow (active state) */}
      {isActive && (
        <span style={{
          position: 'absolute', inset: -1, borderRadius: 2,
          background: `conic-gradient(from var(--_a,0deg), transparent 30%, ${accent} 50%, transparent 70%)`,
          animation: 'btnBorderFlow 2s linear infinite',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          padding: 1,
          pointerEvents: 'none',
        }} />
      )}

      {/* Light Sweep (hover) */}
      {sweepX !== null && (
        <span style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${sweepX}%`, width: '55%',
          background: `linear-gradient(90deg, transparent, ${accent}25, ${accent}55, ${accent}25, transparent)`,
          transform: 'skewX(-18deg)',
          pointerEvents: 'none', zIndex: 1,
          transition: 'none',
        }} />
      )}

      {/* Icon */}
      <span style={{
        fontSize: 14, position: 'relative', zIndex: 2, flexShrink: 0,
        animation: loading ? 'btnRadar 1.2s ease-in-out infinite' : 'none',
      }}>
        {icon}
      </span>

      {/* Label */}
      <span style={{ position: 'relative', zIndex: 2 }}>
        {loading ? '...' : label}
      </span>

      <style>{`
        @keyframes btnBorderFlow {
          0%   { --_a: 0deg; }
          100% { --_a: 360deg; }
        }
        @keyframes btnRadar {
          0%,100% { opacity:1;   transform:scale(1); }
          50%      { opacity:0.2; transform:scale(0.85); }
        }
      `}</style>
    </button>
  );
}
