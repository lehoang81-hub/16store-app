'use client';

import { useState } from 'react';
import type { SocialCardStyle, TaglineLang } from '@/lib/social-card/config';

// ============================================================================
// TYPES
// ============================================================================

interface GenerateResponse {
  posterUrl: string;
  publicCode: string;
  tagline: string;
  cached: boolean;
  taglineSource: 'ai' | 'fallback';
  remaining?: number;
  error?: string;
  errorCode?: string;
  resetAt?: string;
}

interface Props {
  passportId: string;
  lotId: string;
  brand: string;
  model: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STYLES: { value: SocialCardStyle; label: string; desc: string; icon: string }[] = [
  { value: 'editorial', label: 'Editorial', desc: 'Hoài niệm · Di sản', icon: '🏚' },
  { value: 'street',    label: 'Street',    desc: 'Đô thị · Đêm neon', icon: '🌆' },
  { value: 'archive',   label: 'Archive',   desc: 'Tối giản · Bảo tàng', icon: '🏛' },
];

const LOADING_STEPS = [
  'Đang sinh tagline AI...',
  'Đang vẽ background...',
  'Đang ghép poster...',
  'Đang lưu poster...',
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SocialCardGenerator({ passportId, lotId, brand, model }: Props) {
  const [style, setStyle] = useState<SocialCardStyle>('editorial');
  const [lang, setLang] = useState<TaglineLang>('vi');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // ─── Generate poster ───
  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setLoadingStep(0);

    // Animate loading steps
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 6000); // Mỗi step ~6s (total ~24s)

    try {
      const res = await fetch('/api/social-card/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passportId, style, taglineLang: lang }),
      });

      const data: GenerateResponse = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Lỗi không xác định');
        if (data.errorCode === 'user_rate_limit') {
          setRemaining(0);
        }
      } else {
        setResult(data);
        if (data.remaining !== undefined) {
          setRemaining(data.remaining);
        }
      }
    } catch (err) {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
      setLoadingStep(0);
    }
  }

  // ─── Download poster ───
  async function handleDownload() {
    if (!result?.posterUrl) return;

    try {
      const res = await fetch(result.posterUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `16store-${lotId}-${style}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(result.posterUrl, '_blank');
    }
  }

  // ─── Copy link ───
  async function handleCopyLink() {
    if (!result?.posterUrl) return;
    try {
      await navigator.clipboard.writeText(result.posterUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  // ─── Share platforms ───
  function handleShare(platform: 'facebook' | 'zalo' | 'telegram' | 'twitter') {
    if (!result?.posterUrl) return;

    const pageUrl = window.location.href;
    const text = `${brand} ${model} — ${result.tagline}\n${pageUrl}`;

    const urls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`,
      zalo: `https://zalo.me/share/url?url=${encodeURIComponent(pageUrl)}&title=${encodeURIComponent(text)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(text)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    };

    window.open(urls[platform], '_blank', 'width=600,height=400');
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <section className="border border-line">

      {/* ─── Header (always visible, click to expand) ─── */}
      <button
        className="w-full p-6 flex items-center justify-between hover:bg-ink-2/50 transition-colors text-left"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <div>
          <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-rust inline-block" />
            Tạo Poster AI · Social Card
          </div>
          <h3 className="font-display text-xl uppercase">
            Poster độc quyền{' '}
            <span className="font-serif italic text-rust normal-case">cho đôi giày này</span>
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {remaining !== null && remaining > 0 && (
            <span className="font-mono text-[10px] text-bone-2 tracking-[0.14em] uppercase">
              còn {remaining} lượt
            </span>
          )}
          {remaining === 0 && (
            <span className="font-mono text-[10px] text-hazard tracking-[0.14em] uppercase">
              hết lượt hôm nay
            </span>
          )}
          <span
            className="font-mono text-[10px] text-concrete tracking-[0.14em] transition-transform duration-200"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}
          >
            ▼
          </span>
        </div>
      </button>

      {/* ─── Collapsible content ─── */}
      {isExpanded && (
        <div className="border-t border-line">

          {/* Style picker */}
          <div className="p-6 border-b border-line">
            <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase mb-4">
              Phong cách
            </div>
            <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className={`p-4 border text-left transition-all ${
                    style === s.value
                      ? 'border-rust bg-rust/8'
                      : 'border-line hover:border-bone-2'
                  }`}
                >
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <div className={`font-display text-base uppercase mb-1 ${
                    style === s.value ? 'text-rust' : 'text-bone'
                  }`}>
                    {s.label}
                  </div>
                  <div className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase">
                    {s.desc}
                  </div>
                  {style === s.value && (
                    <div className="mt-2 font-mono text-[9px] text-rust tracking-[0.14em] uppercase">
                      ◆ Đang chọn
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Language picker */}
          <div className="p-6 border-b border-line">
            <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase mb-4">
              Ngôn ngữ tagline
            </div>
            <div className="flex gap-4">
              {[
                { value: 'vi' as TaglineLang, label: '🇻🇳 Tiếng Việt' },
                { value: 'en' as TaglineLang, label: '🇺🇸 English' },
              ].map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLang(l.value)}
                  className={`flex items-center gap-2 px-5 py-3 border font-mono text-[11px] tracking-[0.16em] uppercase transition-all ${
                    lang === l.value
                      ? 'border-rust text-rust bg-rust/8'
                      : 'border-line text-bone-2 hover:border-bone-2'
                  }`}
                >
                  {l.label}
                  {lang === l.value && <span className="text-rust">◆</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <div className="p-6 border-b border-line">
            <button
              onClick={handleGenerate}
              disabled={loading || remaining === 0}
              className={`w-full py-4 font-mono text-[12px] tracking-[0.22em] uppercase transition-all ${
                loading || remaining === 0
                  ? 'bg-line text-concrete cursor-not-allowed'
                  : 'bg-rust text-ink hover:bg-bone hover:text-ink'
              }`}
            >
              {loading
                ? '⏳ Đang tạo poster...'
                : remaining === 0
                ? '⛔ Hết lượt hôm nay'
                : `✨ Tạo Poster ${STYLES.find(s => s.value === style)?.label}`}
            </button>

            <div className="mt-3 font-mono text-[10px] text-concrete tracking-[0.14em] text-center">
              Mỗi pair tối đa 3 posters/ngày · Cache 7 ngày · AI generate unique mỗi lần
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="p-8 border-b border-line">
              <div className="max-w-sm mx-auto">
                {LOADING_STEPS.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 mb-3 transition-all duration-500 ${
                      idx < loadingStep
                        ? 'opacity-40'
                        : idx === loadingStep
                        ? 'opacity-100'
                        : 'opacity-20'
                    }`}
                  >
                    <div className={`w-5 h-5 flex items-center justify-center font-mono text-[11px] ${
                      idx < loadingStep
                        ? 'text-bone-2'
                        : idx === loadingStep
                        ? 'text-rust animate-pulse'
                        : 'text-concrete'
                    }`}>
                      {idx < loadingStep ? '✓' : idx === loadingStep ? '●' : '○'}
                    </div>
                    <span className={`font-mono text-[11px] tracking-[0.14em] uppercase ${
                      idx === loadingStep ? 'text-bone' : 'text-concrete'
                    }`}>
                      {step}
                    </span>
                  </div>
                ))}

                <div className="mt-6 font-mono text-[10px] text-concrete tracking-[0.14em] text-center">
                  Gemini AI đang vẽ background · Thường mất 15-30 giây
                </div>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="p-6 border-b border-line">
              <div className="border border-hazard bg-hazard/5 p-4">
                <div className="font-mono text-[10px] text-hazard tracking-[0.18em] uppercase mb-2">
                  ⚠ Không tạo được poster
                </div>
                <p className="font-body text-sm text-bone-2">{error}</p>
                {remaining === 0 && (
                  <p className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase mt-2">
                    Reset lúc 00:00 ngày hôm sau
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Result state */}
          {result && !loading && (
            <div className="p-6">

              {/* Cache badge */}
              {result.cached && (
                <div className="mb-4 font-mono text-[10px] text-bone-2 tracking-[0.14em] uppercase flex items-center gap-2">
                  <span className="text-hazard">⚡</span>
                  Poster đã có trong cache · Tải ngay, không dùng lượt
                </div>
              )}

              {/* Tagline display */}
              <div className="mb-5 border-l-2 border-rust pl-4">
                <div className="font-mono text-[10px] text-rust tracking-[0.18em] uppercase mb-2">
                  AI Tagline {result.taglineSource === 'fallback' ? '(mẫu)' : ''}
                </div>
                <p className="font-serif italic text-lg text-bone leading-relaxed">
                  "{result.tagline}"
                </p>
              </div>

              {/* Poster preview */}
              <div className="mb-5 border border-line overflow-hidden">
                <img
                  src={result.posterUrl}
                  alt={`Poster ${brand} ${model}`}
                  className="w-full object-contain"
                  style={{ maxHeight: '600px' }}
                />
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 mb-4 max-sm:grid-cols-1">
                <button
                  onClick={handleDownload}
                  className="py-3 bg-rust text-ink font-mono text-[11px] tracking-[0.2em] uppercase hover:bg-bone transition-colors"
                >
                  ⬇ Tải poster về
                </button>
                <button
                  onClick={handleCopyLink}
                  className={`py-3 border font-mono text-[11px] tracking-[0.2em] uppercase transition-colors ${
                    copied
                      ? 'border-bone text-bone'
                      : 'border-line text-bone-2 hover:border-bone-2'
                  }`}
                >
                  {copied ? '✓ Đã copy!' : '🔗 Copy link poster'}
                </button>
              </div>

              {/* Share buttons */}
              <div className="border-t border-line pt-4">
                <div className="font-mono text-[10px] text-concrete tracking-[0.18em] uppercase mb-3">
                  Chia sẻ trang passport
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { platform: 'facebook' as const, label: 'Facebook', color: 'text-[#4267B2]' },
                    { platform: 'zalo' as const, label: 'Zalo', color: 'text-[#0068ff]' },
                    { platform: 'telegram' as const, label: 'Telegram', color: 'text-[#2AABEE]' },
                    { platform: 'twitter' as const, label: 'X / Twitter', color: 'text-bone' },
                  ].map(({ platform, label, color }) => (
                    <button
                      key={platform}
                      onClick={() => handleShare(platform)}
                      className={`px-4 py-2 border border-line font-mono text-[10px] tracking-[0.14em] uppercase hover:border-bone-2 transition-colors ${color}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Remaining count */}
              {result.remaining !== undefined && result.remaining > 0 && (
                <div className="mt-4 font-mono text-[10px] text-concrete tracking-[0.14em] text-center">
                  Còn {result.remaining} lượt tạo poster cho pair này hôm nay
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </section>
  );
}
