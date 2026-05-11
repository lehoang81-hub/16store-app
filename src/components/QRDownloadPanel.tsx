'use client';

import { useState } from 'react';
import { ensurePassport } from '@/lib/actions/ensure-passport';

interface Props {
  postId: string;
  lotId: string;
}

/**
 * Panel cho hub admin / super_admin tạo và download QR PDF.
 * Tự động tạo passport nếu chưa có.
 */
export function QRDownloadPanel({ postId, lotId }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [passportInfo, setPassportInfo] = useState<{ id: string; qr_code: string } | null>(null);

  async function handleEnsurePassport() {
    setBusy('passport');
    setError('');
    try {
      const result = await ensurePassport({ post_id: postId });
      if (result.success && result.passport) {
        setPassportInfo(result.passport);
      } else {
        setError(result.error ?? 'Không tạo được passport');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi');
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload(type: 'sticker' | 'tag' | 'card') {
    if (!passportInfo) {
      await handleEnsurePassport();
      return;
    }
    setBusy(type);
    try {
      const url = `/api/admin/qr-pdf?passport_id=${passportInfo.id}&type=${type}`;
      window.open(url, '_blank');
    } finally {
      setTimeout(() => setBusy(null), 1500);
    }
  }

  return (
    <div className="border border-line bg-ink-2/40 p-6">
      <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
        QR PDF · {lotId}
      </div>

      <p className="font-body text-sm text-bone-2 mb-5">
        Tạo file PDF chứa mã QR để in dán/treo/tặng cùng pair.
      </p>

      {!passportInfo ? (
        <div>
          <button
            onClick={handleEnsurePassport}
            disabled={busy === 'passport'}
            className="w-full bg-rust text-ink py-3 font-mono text-[11px] tracking-[0.2em] uppercase hover:bg-bone transition-colors disabled:opacity-40 mb-3"
          >
            {busy === 'passport' ? 'Đang tạo...' : '⚡ Tạo Hộ Chiếu (passport)'}
          </button>
          <p className="font-mono text-[10px] text-concrete tracking-[0.14em]">
            Bước này tạo QR code unique cho pair. Sau đó mới download được PDF.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="border border-line p-3 mb-4">
            <div className="font-mono text-[9px] text-concrete tracking-[0.14em] uppercase mb-1">QR Code</div>
            <code className="font-mono text-sm text-rust">{passportInfo.qr_code}</code>
          </div>

          <button
            onClick={() => handleDownload('sticker')}
            disabled={busy === 'sticker'}
            className="w-full border border-line-strong text-bone py-3 font-mono text-[11px] tracking-[0.18em] uppercase hover:bg-rust hover:text-ink hover:border-rust transition-colors disabled:opacity-40"
          >
            {busy === 'sticker' ? 'Đang tạo PDF...' : '📄 Sticker 4cm vuông (24/page)'}
          </button>

          <button
            onClick={() => handleDownload('tag')}
            disabled={busy === 'tag'}
            className="w-full border border-line-strong text-bone py-3 font-mono text-[11px] tracking-[0.18em] uppercase hover:bg-rust hover:text-ink hover:border-rust transition-colors disabled:opacity-40"
          >
            {busy === 'tag' ? 'Đang tạo PDF...' : '🏷 Tag treo lưỡi gà (9/page)'}
          </button>

          <button
            onClick={() => handleDownload('card')}
            disabled={busy === 'card'}
            className="w-full border border-line-strong text-bone py-3 font-mono text-[11px] tracking-[0.18em] uppercase hover:bg-rust hover:text-ink hover:border-rust transition-colors disabled:opacity-40"
          >
            {busy === 'card' ? 'Đang tạo PDF...' : '💳 Card tặng kèm (8/page)'}
          </button>

          <div className="pt-3 mt-3 border-t border-line font-mono text-[10px] text-concrete tracking-[0.14em] leading-[1.5]">
            <div>📄 Sticker — in giấy decal vinyl, dán dưới lưỡi gà</div>
            <div>🏷 Tag — in giấy mỹ thuật + bấm lỗ + treo dây</div>
            <div>💳 Card — in giấy 350gsm, tặng kèm khi giao buyer</div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 border border-rust bg-rust/10 text-rust font-mono text-[11px]">
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
