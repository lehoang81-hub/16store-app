'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PosterData {
  brand:        string;
  model:        string;
  colorway?:    string;
  qrCode:       string;
  price?:       number;
  heroUrl?:     string;
  description?: string;
  ownerCount?:  number;
  soulScore?:   number;
  ownerHandle?: string;  // Chủ nhân hiện tại
  variant?:     'listing' | 'identity';
}

export type ConceptType = 'archive' | 'lifestyle' | 'emotional';

interface Props {
  data:     PosterData;
  concept:  ConceptType;
  onReady?: (dataUrl: string) => void;
}

// ─── Themes ───────────────────────────────────────────────────────────────────

const THEMES = {
  archive:   { bg: '#0a0a0f', accent: '#C8531C', text: '#ebe6dc', muted: '#666', label: 'ARCHIVE EDITION' },
  lifestyle: { bg: '#080a04', accent: '#d4af37', text: '#f5f0e8', muted: '#776', label: 'LIFESTYLE EDITION' },
  emotional: { bg: '#04080e', accent: '#5DCAA5', text: '#e8f5f0', muted: '#567', label: 'MEMORY EDITION' },
} as const;

// ─── Image loader (proxy để bypass CORS hoàn toàn) ────────────────────────────

async function loadHeroImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return null;
  try {
    // Proxy qua Next.js API route → server fetch không bị CORS
    const proxyUrl = `/api/img-proxy?url=${encodeURIComponent(url)}`;
    const res  = await fetch(proxyUrl);
    if (!res.ok) return null;

    const blob = await res.blob();
    const burl = URL.createObjectURL(blob);

    return new Promise(resolve => {
      const img   = new Image();
      img.onload  = () => { URL.revokeObjectURL(burl); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(burl); resolve(null); };
      img.src     = burl;
    });
  } catch {
    return null;
  }
}

// ─── Canvas dimensions ────────────────────────────────────────────────────────

const W = 1080;
const H = 1350;
const M = 56; // margin

// ─── Component ────────────────────────────────────────────────────────────────

export function PosterCanvas({ data, concept, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrRef     = useRef<SVGSVGElement | null>(null);
  const drawnRef  = useRef(false);

  const [ready,   setReady]   = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [status,  setStatus]  = useState('Đang chuẩn bị...');

  const theme = THEMES[concept];
  const isIdentity = data.variant === 'identity' || !data.price;

  useEffect(() => {
    // Reset khi props thay đổi
    drawnRef.current = false;
    setReady(false);
    setDataUrl(null);
    setStatus('Đang chuẩn bị...');

    // Đợi QR SVG render xong
    const timer = setTimeout(async () => {
      if (drawnRef.current) return;
      drawnRef.current = true;

      // 🔍 DEBUG — xóa sau khi confirm ảnh hiện
      console.log('[PosterCanvas] data.heroUrl:', data.heroUrl);
      console.log('[PosterCanvas] full data:', data);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width  = W;
      canvas.height = H;

      // ── 1. Background ──────────────────────────────────────────────────────
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, W, H);

      // Noise grain effect
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.012})`;
        ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
      }

      // ── 2. Header bar ──────────────────────────────────────────────────────
      ctx.fillStyle = theme.accent + '18';
      ctx.fillRect(0, 0, W, 76);

      ctx.strokeStyle = theme.accent + '55';
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, 76); ctx.lineTo(W, 76);
      ctx.stroke();

      // Logo "16 STORE"
      ctx.font      = 'bold 22px monospace';
      ctx.fillStyle = theme.text;
      ctx.textAlign = 'left';
      ctx.fillText('16', M, 48);
      ctx.fillStyle = theme.accent;
      ctx.fillText('STORE', M + 36, 48);

      // Edition label
      ctx.textAlign = 'right';
      ctx.font      = '11px monospace';
      ctx.fillStyle = theme.accent;
      ctx.fillText(theme.label, W - M, 48);
      ctx.textAlign = 'left';

      // ── 3. Cinematic image frame ───────────────────────────────────────────
      const imgY = 76 + M;
      const imgW = W - M * 2;
      const imgH = 660;
      const fp   = 14; // frame padding

      const fx = M - fp, fy = imgY - fp;
      const fw = imgW + fp * 2, fh = imgH + fp * 2;

      // Outer glow
      ctx.shadowColor = theme.accent;
      ctx.shadowBlur  = 20;
      ctx.strokeStyle = theme.accent + '50';
      ctx.lineWidth   = 1;
      ctx.strokeRect(fx - 3, fy - 3, fw + 6, fh + 6);
      ctx.shadowBlur  = 0;

      // Frame fill + border
      ctx.fillStyle   = theme.bg;
      ctx.fillRect(fx, fy, fw, fh);
      ctx.strokeStyle = theme.accent + '55';
      ctx.lineWidth   = 1;
      ctx.strokeRect(fx, fy, fw, fh);
      ctx.strokeStyle = theme.accent + '20';
      ctx.lineWidth   = 0.5;
      ctx.strokeRect(fx + 7, fy + 7, fw - 14, fh - 14);

      // Corner brackets
      const cl = 22;
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth   = 2;
      const corners: [number, number, number, number][] = [
        [fx,      fy,      1,  1],
        [fx + fw, fy,     -1,  1],
        [fx,      fy + fh, 1, -1],
        [fx + fw, fy + fh,-1, -1],
      ];
      for (const [cx, cy, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + sy * cl);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + sx * cl, cy);
        ctx.stroke();
      }

      // ── 4. Hero image ──────────────────────────────────────────────────────
      setStatus('Đang tải ảnh...');
      let heroImg: HTMLImageElement | null = null;

      if (data.heroUrl) {
        heroImg = await loadHeroImage(data.heroUrl);
      }

      if (heroImg && heroImg.naturalWidth > 0) {
        // Cover fit
        const scale = Math.max(imgW / heroImg.naturalWidth, imgH / heroImg.naturalHeight);
        const dw    = heroImg.naturalWidth  * scale;
        const dh    = heroImg.naturalHeight * scale;

        ctx.save();
        ctx.beginPath();
        ctx.rect(M, imgY, imgW, imgH);
        ctx.clip();
        ctx.drawImage(heroImg, M + (imgW - dw) / 2, imgY + (imgH - dh) / 2, dw, dh);
        ctx.restore();

        // Gradient fade bottom
        const fade = ctx.createLinearGradient(0, imgY + imgH * 0.45, 0, imgY + imgH);
        fade.addColorStop(0, 'transparent');
        fade.addColorStop(1, theme.bg + 'ee');
        ctx.fillStyle = fade;
        ctx.fillRect(M, imgY, imgW, imgH);
      } else {
        // Placeholder gradient
        const g = ctx.createLinearGradient(M, imgY, M + imgW, imgY + imgH);
        g.addColorStop(0, theme.accent + '28');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle   = g;
        ctx.fillRect(M, imgY, imgW, imgH);
        ctx.font        = '18px monospace';
        ctx.fillStyle   = theme.accent + '50';
        ctx.textAlign   = 'center';
        ctx.fillText(`${data.brand} ${data.model}`, W / 2, imgY + imgH / 2);
        ctx.textAlign   = 'left';
      }

      // ── 5. Text content ────────────────────────────────────────────────────
      setStatus('Đang render...');

      const contentY = imgY + imgH + fp + M - 8;

      // Divider
      ctx.strokeStyle = theme.accent + '30';
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(M, contentY); ctx.lineTo(W - M, contentY);
      ctx.stroke();

      // Brand — wrap to 2 lines if long
      ctx.font      = 'bold 52px Arial, sans-serif';
      ctx.fillStyle = theme.text;
      const brandText = data.brand.toUpperCase();
      const brandMaxW = W - M * 2 - 120;
      let brandY = contentY + 56;
      if (ctx.measureText(brandText).width > brandMaxW) {
        // Split into 2 lines at space or midpoint
        const mid = brandText.lastIndexOf(' ', Math.ceil(brandText.length / 2)) || Math.ceil(brandText.length / 2);
        ctx.fillText(brandText.slice(0, mid).trim(), M, brandY);
        ctx.fillText(brandText.slice(mid).trim(), M, brandY + 58);
        brandY += 58;
      } else {
        ctx.fillText(brandText, M, brandY);
      }

      // Model — wrap to 2 lines if long
      ctx.font      = 'bold 34px Arial, sans-serif';
      ctx.fillStyle = theme.accent;
      const modelText = data.model;
      const modelMaxW = W - M * 2 - 120;
      let modelY = brandY + 46;
      if (ctx.measureText(modelText).width > modelMaxW) {
        const mid2 = modelText.lastIndexOf(' ', Math.ceil(modelText.length / 2)) || Math.ceil(modelText.length / 2);
        ctx.fillText(modelText.slice(0, mid2).trim(), M, modelY);
        ctx.fillText(modelText.slice(mid2).trim(), M, modelY + 42);
        modelY += 42;
      } else {
        ctx.fillText(modelText, M, modelY);
      }

      // Colorway
      const colorwayY = modelY + 32;
      if (data.colorway) {
        ctx.font      = 'italic 20px Georgia, serif';
        ctx.fillStyle = theme.muted;
        ctx.fillText(`"${data.colorway}"`, M, colorwayY);
      }

      // Stats row
      const statsY = data.colorway ? colorwayY + 36 : modelY + 32;
      ctx.font      = '13px monospace';
      ctx.fillStyle = theme.accent + '88';
      let sx = M;
      if (data.soulScore)  { ctx.fillText(`✦ ${data.soulScore} pts`, sx, statsY); sx += 150; }
      if (data.ownerCount) { ctx.fillText(`⟳ ${data.ownerCount} chủ nhân`, sx, statsY); sx += 180; }
      // Current owner handle
      if (data.ownerHandle) {
        ctx.font      = '12px monospace';
        ctx.fillStyle = theme.text + 'aa';
        ctx.fillText(`· @${data.ownerHandle}`, sx, statsY);
      }

      // Description (max 2 lines)
      if (data.description) {
        ctx.font      = 'italic 16px Georgia, serif';
        ctx.fillStyle = theme.text + '99';
        const maxW  = W - M * 2 - 160;
        const words = data.description.split(' ');
        let line = '', lineY = statsY + 36, lineCount = 0;

        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > maxW && line) {
            ctx.fillText(lineCount === 0 ? `"${line}` : line, M, lineY);
            line = word;
            lineY += 26;
            lineCount++;
            if (lineCount >= 2) {
              ctx.fillText(line + '..."', M, lineY);
              line = '';
              break;
            }
          } else {
            line = test;
          }
        }
        if (line) {
          ctx.fillText(lineCount === 0 ? `"${line}"` : line + (lineCount ? '"' : ''), M, lineY);
        }
      }

      // ── 6. Price / Identity badge ──────────────────────────────────────────
      const priceY = H - 165;

      if (!isIdentity && data.price) {
        ctx.font      = 'bold 40px monospace';
        ctx.fillStyle = theme.accent;
        ctx.fillText(
          new Intl.NumberFormat('vi-VN').format(data.price) + ' VNĐ',
          M, priceY
        );
      } else {
        ctx.font      = 'bold 18px monospace';
        ctx.fillStyle = theme.accent;
        ctx.fillText('HỘ CHIẾU VẬT PHẨM · 16STORE', M, priceY);
        ctx.font      = '13px monospace';
        ctx.fillStyle = theme.muted;
        ctx.fillText(data.qrCode, M, priceY + 28);
      }

      // ── 7. QR code — bigger for easy scanning ──────────────────────────────
      const qrSize = 148;
      const qrX    = W - M - qrSize;
      const qrY2   = priceY - qrSize - 4;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(qrX - 8, qrY2 - 8, qrSize + 16, qrSize + 16);
      ctx.strokeStyle = theme.accent + '40';
      ctx.lineWidth   = 1;
      ctx.strokeRect(qrX - 8, qrY2 - 8, qrSize + 16, qrSize + 16);

      const svgEl = qrRef.current;
      if (svgEl) {
        const svgStr = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([svgStr], { type: 'image/svg+xml' });
        const svgUrl  = URL.createObjectURL(svgBlob);

        const qrImg = new Image();
        await new Promise<void>(resolve => {
          qrImg.onload  = () => resolve();
          qrImg.onerror = () => resolve();
          qrImg.src     = svgUrl;
        });
        if (qrImg.naturalWidth > 0) {
          ctx.drawImage(qrImg, qrX, qrY2, qrSize, qrSize);
        }
        URL.revokeObjectURL(svgUrl);
      }

      // ── 8. Footer ──────────────────────────────────────────────────────────
      ctx.fillStyle   = theme.accent + '12';
      ctx.fillRect(0, H - 68, W, 68);

      ctx.strokeStyle = theme.accent + '30';
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, H - 68); ctx.lineTo(W, H - 68);
      ctx.stroke();

      ctx.font      = '12px monospace';
      ctx.fillStyle = theme.accent + 'cc';
      ctx.textAlign = 'left';
      ctx.fillText(`${process.env.NEXT_PUBLIC_APP_URL?.replace('https://','')}/${data.qrCode}`, M, H - 26);
      ctx.textAlign = 'right';
      ctx.fillStyle = theme.muted;
      ctx.fillText('Quét QR để xem hộ chiếu', W - M, H - 26);
      ctx.textAlign = 'left';

      // ── Done ───────────────────────────────────────────────────────────────
      const url = canvas.toDataURL('image/png', 0.92);
      setDataUrl(url);
      setReady(true);
      setStatus('Xong!');
      console.log('[PosterCanvas] onReady called, url length:', url.length);    
      onReady?.(url);
    }, 600);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.qrCode, data.heroUrl, data.price, concept]);
  // onReady excluded intentionally — calling it doesn't require re-draw

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* QR rendered off-screen để capture vào canvas */}
      <div style={{ position: 'absolute', left: -9999, top: 0 }}>
        <QRCodeSVG
          ref={(el: SVGSVGElement | null) => { qrRef.current = el; }}
          value={`${process.env.NEXT_PUBLIC_APP_URL}/passport/${data.qrCode}`}
          size={100}
          level="H"
          fgColor="#1a0805"
          bgColor="#ffffff"
        />
      </div>

      {/* Canvas hidden — chỉ dùng để render, output là img */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* UI */}
      {!ready ? (
        <div style={{
          aspectRatio: '4/5',
          width:       '100%',
          background:  theme.bg,
          border:      `1px solid ${theme.accent}25`,
          display:     'flex',
          flexDirection: 'column',
          alignItems:  'center',
          justifyContent: 'center',
          gap: 14,
        }}>
          <div style={{
            width:          26,
            height:         26,
            borderRadius:   '50%',
            border:         `2px solid ${theme.accent}`,
            borderTopColor: 'transparent',
            animation:      'poster-spin 0.9s linear infinite',
          }} />
          <div style={{
            fontFamily:    'monospace',
            fontSize:       10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color:          theme.accent,
          }}>
            {status}
          </div>
          <style>{`@keyframes poster-spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : dataUrl ? (
        <img
          src={dataUrl}
          alt={`${data.brand} ${data.model} poster`}
          style={{
            width:   '100%',
            display: 'block',
            border:  `1px solid ${theme.accent}30`,
          }}
        />
      ) : null}
    </div>
  );
}
