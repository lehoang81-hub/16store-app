'use client';

import { useState } from 'react';

interface Props {
  qrCode: string;
  brand: string;
  model: string;
  cityCount: number;
}

/**
 * Share button cho passport.
 * Tạo URL có OG metadata để Facebook/Twitter preview đẹp.
 */
export function ShareButton({ qrCode, brand, model, cityCount }: Props) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // URL chia sẻ
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/passport/${qrCode}`
    : `/passport/${qrCode}`;

  const shareText = `${brand} ${model} — đã đi qua ${cityCount} thành phố. Xem hành trình đôi giày này:`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  function handleFacebook() {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'width=600,height=400');
  }

  function handleTwitter() {
    const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'width=600,height=400');
  }

  function handleTelegram() {
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  }

  function handleZalo() {
    const url = `https://zalo.me/share/?u=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 border border-rust text-rust px-4 py-2 font-mono text-[11px] tracking-[0.2em] uppercase hover:bg-rust hover:text-ink transition-colors"
      >
        ↗ Chia sẻ
      </button>

      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setMenuOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full right-0 mt-2 z-40 bg-ink border border-line-strong min-w-[280px] shadow-2xl">
            <div className="p-4 border-b border-line">
              <div className="font-mono text-[9px] text-rust tracking-[0.22em] uppercase mb-2">
                Chia sẻ hành trình
              </div>
              <div className="font-display text-sm uppercase text-bone mb-1">
                {brand} {model}
              </div>
              <div className="font-mono text-[10px] text-bone-2">
                {cityCount} thành phố
              </div>
            </div>

            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 p-4 border-b border-line hover:bg-rust/10 transition-colors text-left"
            >
              <span className="text-lg">🔗</span>
              <div>
                <div className="font-mono text-[11px] text-bone tracking-[0.12em] uppercase">
                  {copied ? '✓ Đã copy!' : 'Copy link'}
                </div>
                <div className="font-mono text-[9px] text-concrete mt-0.5 truncate max-w-[200px]">
                  {shareUrl.replace(/https?:\/\//, '')}
                </div>
              </div>
            </button>

            <button
              onClick={handleFacebook}
              className="w-full flex items-center gap-3 p-3 border-b border-line hover:bg-rust/10 transition-colors text-left"
            >
              <span className="text-lg">📘</span>
              <span className="font-mono text-[11px] text-bone tracking-[0.12em] uppercase">
                Facebook
              </span>
            </button>

            <button
              onClick={handleZalo}
              className="w-full flex items-center gap-3 p-3 border-b border-line hover:bg-rust/10 transition-colors text-left"
            >
              <span className="text-lg">💬</span>
              <span className="font-mono text-[11px] text-bone tracking-[0.12em] uppercase">
                Zalo
              </span>
            </button>

            <button
              onClick={handleTelegram}
              className="w-full flex items-center gap-3 p-3 border-b border-line hover:bg-rust/10 transition-colors text-left"
            >
              <span className="text-lg">✈️</span>
              <span className="font-mono text-[11px] text-bone tracking-[0.12em] uppercase">
                Telegram
              </span>
            </button>

            <button
              onClick={handleTwitter}
              className="w-full flex items-center gap-3 p-3 hover:bg-rust/10 transition-colors text-left"
            >
              <span className="text-lg">🐦</span>
              <span className="font-mono text-[11px] text-bone tracking-[0.12em] uppercase">
                Twitter / X
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
