// src/lib/social-card/compose-poster.ts
// v4 FINAL — Archive: tagline+text ở top zone (y<500), sneaker giữa frame

import sharp from 'sharp';
import QRCode from 'qrcode';
import { SOCIAL_CARD_CONFIG } from './config';
import type { SocialCardStyle } from './config';

export interface ComposeInput {
  backgroundBuffer: Buffer | null;
  style: SocialCardStyle;
  brand: string; model: string; colorway: string; tagline: string;
  cityCount: number; scanCount: number; ownerCount: number;
  lotId: string; qrCode: string; qrUrl: string;
}

interface StylePalette {
  bgFallback: string;
  overlayTop: string; overlayMid: string; overlayBottom: string;
  textPrimary: string; textSecondary: string;
  textAccent: string; textMuted: string;
  borderColor: string; platePlate: string;
  fontDisplay: string; fontMono: string; fontSerif: string;
}

const PALETTES: Record<SocialCardStyle, StylePalette> = {
  editorial: {
    bgFallback: '#141416',
    overlayTop: 'rgba(20,20,22,0.75)', overlayMid: 'rgba(20,20,22,0.25)', overlayBottom: 'rgba(20,20,22,0.88)',
    textPrimary: '#ebe6dc', textSecondary: '#a8a89d', textAccent: '#c8531c', textMuted: '#8a8a80',
    borderColor: '#e0a23a', platePlate: 'rgba(20,20,22,0.7)',
    fontDisplay: 'Arial Black, Impact, sans-serif', fontMono: 'Courier New, monospace', fontSerif: 'Georgia, serif',
  },
  street: {
    bgFallback: '#0a0a0f',
    overlayTop: 'rgba(10,10,15,0.78)', overlayMid: 'rgba(10,10,15,0.3)', overlayBottom: 'rgba(10,10,15,0.9)',
    textPrimary: '#ffffff', textSecondary: '#00f5ff', textAccent: '#ff0080', textMuted: '#808090',
    borderColor: '#ff0080', platePlate: 'rgba(10,10,15,0.75)',
    fontDisplay: 'Impact, Arial Black, sans-serif', fontMono: 'Courier New, monospace', fontSerif: 'Georgia, serif',
  },
  archive: {
    bgFallback: '#f5f3ee',
    overlayTop: 'rgba(245,243,238,0)', overlayMid: 'rgba(245,243,238,0)', overlayBottom: 'rgba(245,243,238,0.92)',
    textPrimary: '#1a1a1c', textSecondary: '#4a4a4c', textAccent: '#c8531c', textMuted: '#8a8a80',
    borderColor: '#1a1a1c', platePlate: 'rgba(245,243,238,0.95)',
    fontDisplay: 'Georgia, serif', fontMono: 'Courier New, monospace', fontSerif: 'Georgia, serif',
  },
};

// ============================================================================
// TAGLINE FALLBACK POOL — motivational thể thao/vận động
// ============================================================================
const FALLBACK_TAGLINES_VI = [
  'Mỗi bước chân là một trang ký ức. Hành trình chưa bao giờ dừng lại.',
  'Kỷ luật không phải là gánh nặng. Đó là đôi cánh giúp bạn bay xa hơn.',
  'Không phải đỉnh cao tạo nên con người. Chính hành trình leo lên mới làm điều đó.',
  'Mồ hôi hôm nay. Ký ức mãi mãi.',
  'Đôi giày không biết mệt. Chỉ có ý chí mới quyết định bạn dừng lại.',
];

const FALLBACK_TAGLINES_EN = [
  'Every step is a page of memory. The journey never truly ends.',
  'Discipline is not a burden. It is the wings that carry you further.',
  'It is not the summit that shapes you. It is the climb.',
  'Sweat today. Story forever.',
  'The shoes never tire. Only the will decides when to stop.',
];

function getFallbackTagline(lang: 'vi' | 'en', seed: string): string {
  const pool = lang === 'vi' ? FALLBACK_TAGLINES_VI : FALLBACK_TAGLINES_EN;
  // Dùng seed (passportId / qrCode) để chọn tagline consistent cho pair đó
  const idx = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % pool.length;
  return pool[idx];
}

// ============================================================================
// MAIN
// ============================================================================

export async function composePoster(input: ComposeInput): Promise<Buffer> {
  const { POSTER_WIDTH: W, POSTER_HEIGHT: H } = SOCIAL_CARD_CONFIG;
  const palette = PALETTES[input.style];

  const background = input.backgroundBuffer
    ? await sharp(input.backgroundBuffer).resize(W, H, { fit: 'cover', position: 'center' }).png().toBuffer()
    : await createFallbackBg(palette.bgFallback, W, H);

  // Validate + clean tagline, fallback nếu dở
  const validatedTagline = validateAndCleanTagline(
    input.tagline,
    input.style === 'archive' ? 'vi' : 'vi', // lang — đơn giản hoá
    input.qrCode,
  );

  const inputWithCleanTagline = { ...input, tagline: validatedTagline };

  const gradientSvg = buildGradient(W, H, palette, input.style);
  const textSvg = buildText(inputWithCleanTagline, palette, W, H);

  const qrDark = input.style === 'archive' ? '#1a1a1c' : '#ffffff';
  const qrLight = input.style === 'archive' ? '#ffffff' : '#1a1a1c';
  const qrRaw = await QRCode.toBuffer(input.qrUrl, {
    type: 'png', width: 160, margin: 1,
    color: { dark: qrDark, light: qrLight },
    errorCorrectionLevel: 'M',
  });
  const qrPlated = await addQrPlate(qrRaw, input.style === 'archive' ? '#ffffff' : '#1a1a1c');

  return sharp(background)
    .composite([
      { input: Buffer.from(gradientSvg), top: 0, left: 0 },
      { input: Buffer.from(textSvg), top: 0, left: 0 },
      { input: qrPlated, top: H - 250, left: W - 250 },
    ])
    .png({ quality: 92, compressionLevel: 8 })
    .toBuffer();
}

// ============================================================================
// TAGLINE VALIDATION
// ============================================================================

/**
 * Kiểm tra tagline có hợp lệ không:
 * - Không rỗng
 * - Không kết thúc bằng dấu phẩy (câu dở)
 * - Tối thiểu 6 từ (đủ nghĩa)
 * - Không phải chỉ là 2-3 từ vô nghĩa
 *
 * Nếu không hợp lệ → dùng fallback motivational
 */
function validateAndCleanTagline(raw: string, lang: 'vi' | 'en', seed: string): string {
  if (!raw || raw.trim().length < 5) {
    return getFallbackTagline(lang, seed);
  }

  // Bỏ quotes đầu/cuối
  let clean = raw.replace(/^["'""]|["'""]$/g, '').trim();

  // Đếm từ
  const wordCount = clean.split(/\s+/).filter(Boolean).length;

  // Quá ngắn (< 5 từ) → fallback
  if (wordCount < 5) {
    return getFallbackTagline(lang, seed);
  }

  // Kết thúc bằng dấu phẩy → câu dở → thử fix hoặc fallback
  if (clean.endsWith(',')) {
    // Tìm câu hoàn chỉnh cuối cùng
    const lastEnd = Math.max(
      clean.lastIndexOf('.'),
      clean.lastIndexOf('!'),
      clean.lastIndexOf('?'),
    );

    if (lastEnd > clean.length * 0.4) {
      // Có câu hoàn chỉnh → cắt tại đó
      clean = clean.substring(0, lastEnd + 1).trim();
      // Kiểm tra lại độ dài sau khi cắt
      if (clean.split(/\s+/).length >= 4) return clean;
    }

    // Không fix được → fallback
    return getFallbackTagline(lang, seed);
  }

  // Kết thúc bằng dấu chấm lửng lỡ (...) → fallback
  if (clean.endsWith('...') && wordCount < 8) {
    return getFallbackTagline(lang, seed);
  }

  return clean;
}

// ============================================================================
// GRADIENT OVERLAY
// ============================================================================

function buildGradient(w: number, h: number, p: StylePalette, style: SocialCardStyle): string {
  if (style === 'archive') {
    // Archive gradient:
    // - Top 45%: nhẹ (rgba ~0.3) để text top đọc được trên nền trắng
    // - Middle 45-70%: trong suốt hoàn toàn (sneaker zone)
    // - Bottom 70-100%: đặc (stats zone)
    return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="rgba(245,243,238,0.55)"/>
        <stop offset="40%"  stop-color="rgba(245,243,238,0.3)"/>
        <stop offset="48%"  stop-color="rgba(245,243,238,0)"/>
        <stop offset="68%"  stop-color="rgba(245,243,238,0)"/>
        <stop offset="80%"  stop-color="rgba(245,243,238,0.8)"/>
        <stop offset="100%" stop-color="rgba(245,243,238,0.97)"/>
      </linearGradient></defs>
      <rect width="${w}" height="${h}" fill="url(#g)"/>
    </svg>`;
  }

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${p.overlayTop}"/>
      <stop offset="35%"  stop-color="${p.overlayTop}"/>
      <stop offset="55%"  stop-color="${p.overlayMid}"/>
      <stop offset="80%"  stop-color="${p.overlayMid}"/>
      <stop offset="100%" stop-color="${p.overlayBottom}"/>
    </linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
  </svg>`;
}

// ============================================================================
// TEXT SVG
// ============================================================================

function buildText(input: ComposeInput, palette: StylePalette, W: number, H: number): string {
  const X = escapeXml;
  const brand = X(input.brand.toUpperCase());
  const model = X(input.model.toUpperCase());
  const colorway = X(input.colorway);
  const lotId = X(input.lotId);
  const qrCode = X(input.qrCode);
  const mfs = calcModelFont(model);
  const taglineLines = splitTagline(input.tagline, 38, 3);
  const p = 60;

  const defs = `<defs>
    <style>
      .d{font-family:${palette.fontDisplay};font-weight:900}
      .m{font-family:${palette.fontMono};letter-spacing:3px}
      .s{font-family:${palette.fontSerif};font-style:italic}
    </style>
    <filter id="sh">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
      <feOffset dy="1" result="ob"/>
      <feFlood flood-color="#000" flood-opacity="0.3"/>
      <feComposite in2="ob" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

  if (input.style === 'archive') {
    // ════════════════════════════════════════════════════
    // ARCHIVE LAYOUT:
    // TOP ZONE (y < 500): Logo + Tagline + Brand + Model
    // MIDDLE ZONE (y 500-830): [SNEAKER — không text]
    // BOTTOM ZONE (y 830-1350): Stats + QR + Watermark
    // ════════════════════════════════════════════════════

    const tagH = taglineLines.length * 44; // chiều cao block tagline

    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${defs}

      <!-- TOP border -->
      <rect x="0" y="0" width="${W}" height="6" fill="${palette.borderColor}"/>

      <!-- ══ TOP ZONE ══ -->

      <!-- Logo (compact) -->
      <rect x="${p}" y="30" width="40" height="40" fill="${palette.textAccent}"/>
      <text x="${p+20}" y="58" class="d" font-size="18" fill="white" text-anchor="middle">16</text>
      <text x="${p+52}" y="46" class="m" font-size="9" fill="${palette.textSecondary}">16STORE PASSPORT</text>
      <text x="${p+52}" y="64" class="d" font-size="13" fill="${palette.textPrimary}" letter-spacing="1">A MEMORY STORE</text>

      <!-- Lot badge -->
      <text x="${p}" y="100" class="m" font-size="10" fill="${palette.textAccent}">
        ◆ LOT ${lotId} · ${qrCode.toUpperCase()}
      </text>

      <!-- Tagline accent line -->
      <line x1="${p}" y1="125" x2="${p+50}" y2="125"
            stroke="${palette.textAccent}" stroke-width="2.5"/>

      <!-- Tagline (top zone, italic, dark) -->
      ${taglineLines.map((l, i) => `
      <text x="${p}" y="${155 + i * 44}"
            class="s" font-size="30"
            fill="${palette.textSecondary}">
        ${l}
      </text>`).join('')}

      <!-- Brand name -->
      <text x="${p}" y="${155 + tagH + 32}"
            class="d" font-size="16"
            fill="${palette.textSecondary}" letter-spacing="6">
        ${brand}
      </text>

      <!-- Model name (largest element in top zone) -->
      <text x="${p}" y="${155 + tagH + 95}"
            class="d" font-size="${Math.min(mfs, 72)}"
            fill="${palette.textPrimary}" letter-spacing="-1">
        ${model}
      </text>

      <!-- Colorway -->
      ${colorway ? `
      <text x="${p}" y="${155 + tagH + 145}"
            class="s" font-size="22"
            fill="${palette.textAccent}">
        "${colorway}"
      </text>` : ''}

      <!-- ══ BOTTOM ZONE (y > 830) ══ -->

      <!-- Divider -->
      <line x1="${p}" y1="840" x2="${W - p}" y2="840"
            stroke="${palette.textMuted}" stroke-width="1" stroke-opacity="0.4"/>

      <!-- Stats -->
      <g transform="translate(${p}, 870)">
        <text x="0" y="0" class="m" font-size="10" fill="${palette.textMuted}">● CITIES</text>
        <text x="0" y="38" class="d" font-size="36" fill="${palette.textAccent}">${input.cityCount}</text>

        <g transform="translate(160, 0)">
          <text x="0" y="0" class="m" font-size="10" fill="${palette.textMuted}">● SCANS</text>
          <text x="0" y="38" class="d" font-size="36" fill="${palette.textPrimary}">${input.scanCount}</text>
        </g>

        <g transform="translate(320, 0)">
          <text x="0" y="0" class="m" font-size="10" fill="${palette.textMuted}">● OWNERS</text>
          <text x="0" y="38" class="d" font-size="36" fill="${palette.textPrimary}">${input.ownerCount}</text>
        </g>
      </g>

      <!-- Watermark -->
      <text x="${p}" y="${H - 58}" class="m" font-size="9" fill="${palette.textMuted}">SCAN QR →</text>
      <text x="${p}" y="${H - 38}" class="d" font-size="16" fill="${palette.textPrimary}" letter-spacing="2">
        16STORE.APP
      </text>

      <!-- BOTTOM border -->
      <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${palette.textAccent}"/>
    </svg>`;
  }

  // ════════════════════════════════════════════════════
  // EDITORIAL + STREET LAYOUT (giữ nguyên như v3)
  // ════════════════════════════════════════════════════
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${defs}

    <!-- Top accent bar -->
    <rect x="0" y="0" width="${W}" height="10" fill="${palette.borderColor}"/>

    <!-- Logo -->
    <rect x="${p}" y="60" width="54" height="54" fill="${palette.textAccent}"/>
    <text x="${p+27}" y="100" class="d" font-size="26" fill="${palette.bgFallback}" text-anchor="middle">16</text>
    <text x="${p+72}" y="82" class="m" font-size="13" fill="${palette.textSecondary}">16STORE PASSPORT</text>
    <text x="${p+72}" y="108" class="d" font-size="20" fill="${palette.textPrimary}" letter-spacing="1">A MEMORY STORE</text>

    <!-- Lot badge -->
    <text x="${p}" y="170" class="m" font-size="13" fill="${palette.textAccent}">
      ◆ LOT ${lotId} · ${qrCode.toUpperCase()}
    </text>

    <!-- Tagline -->
    <line x1="${p}" y1="230" x2="${p+60}" y2="230" stroke="${palette.textAccent}" stroke-width="3"/>
    ${taglineLines.map((l, i) => `
    <text x="${p}" y="${270 + i * 50}" class="s" font-size="36"
          fill="${palette.textPrimary}" filter="url(#sh)">
      ${l}
    </text>`).join('')}

    <!-- Bottom divider -->
    <line x1="${p}" y1="930" x2="${W-p}" y2="930"
          stroke="${palette.textMuted}" stroke-width="1" stroke-opacity="0.4"/>

    <!-- Brand -->
    <text x="${p}" y="975" class="d" font-size="22"
          fill="${palette.textSecondary}" letter-spacing="8" filter="url(#sh)">
      ${brand}
    </text>

    <!-- Model -->
    <text x="${p}" y="1065" class="d" font-size="${mfs}"
          fill="${palette.textPrimary}" letter-spacing="-1" filter="url(#sh)">
      ${model}
    </text>

    <!-- Colorway -->
    ${colorway ? `
    <text x="${p}" y="1110" class="s" font-size="28"
          fill="${palette.textAccent}" filter="url(#sh)">
      "${colorway}"
    </text>` : ''}

    <!-- Stats -->
    <g transform="translate(${p}, 1190)">
      <text x="0" y="0" class="m" font-size="11" fill="${palette.textMuted}">● CITIES</text>
      <text x="0" y="44" class="d" font-size="42" fill="${palette.textAccent}" filter="url(#sh)">${input.cityCount}</text>

      <g transform="translate(180, 0)">
        <text x="0" y="0" class="m" font-size="11" fill="${palette.textMuted}">● SCANS</text>
        <text x="0" y="44" class="d" font-size="42" fill="${palette.textPrimary}" filter="url(#sh)">${input.scanCount}</text>
      </g>

      <g transform="translate(360, 0)">
        <text x="0" y="0" class="m" font-size="11" fill="${palette.textMuted}">● OWNERS</text>
        <text x="0" y="44" class="d" font-size="42" fill="${palette.textPrimary}" filter="url(#sh)">${input.ownerCount}</text>
      </g>
    </g>

    <!-- Watermark -->
    <text x="${p}" y="1306" class="m" font-size="10" fill="${palette.textMuted}">SCAN QR →</text>
    <text x="${p}" y="1330" class="d" font-size="20"
          fill="${palette.textPrimary}" letter-spacing="2" filter="url(#sh)">
      16STORE.APP
    </text>

    <!-- Bottom bar -->
    <rect x="0" y="${H-8}" width="${W}" height="8" fill="${palette.textAccent}"/>
  </svg>`;
}

// ============================================================================
// HELPERS
// ============================================================================

async function createFallbackBg(color: string, w: number, h: number): Promise<Buffer> {
  return sharp(Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="${color}"/>
    </svg>`
  )).png().toBuffer();
}

async function addQrPlate(qrBuffer: Buffer, plateColor: string): Promise<Buffer> {
  const pad = 15, size = 160, total = size + pad * 2;
  return sharp(Buffer.from(
    `<svg width="${total}" height="${total}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${total}" height="${total}" fill="${plateColor}" rx="4"/>
    </svg>`
  )).composite([{ input: qrBuffer, top: pad, left: pad }]).png().toBuffer();
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function calcModelFont(model: string): number {
  const l = model.length;
  if (l <= 4) return 104;
  if (l <= 8) return 92;
  if (l <= 12) return 76;
  if (l <= 16) return 60;
  return 48;
}

function splitTagline(text: string, maxChars: number, maxLines: number): string[] {
  // Thử split theo câu hoàn chỉnh
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length >= 2) {
    const lines: string[] = [];
    for (const sent of sentences) {
      if (lines.length >= maxLines) break;
      if (sent.length <= maxChars) lines.push(sent.trim());
      else lines.push(...splitWords(sent, maxChars, maxLines - lines.length));
    }
    if (lines.some(l => l.length > 3)) return lines.slice(0, maxLines);
  }
  return splitWords(text, maxChars, maxLines);
}

function splitWords(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= maxChars) {
      cur = (cur + ' ' + w).trim();
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[,;]$/, '') + '...';
    return lines.slice(0, maxLines);
  }
  return lines;
}
