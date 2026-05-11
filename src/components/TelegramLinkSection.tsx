'use client';

import { useState } from 'react';
import { createTelegramLinkToken, unlinkTelegram } from '@/lib/actions/telegram';

export function TelegramLinkSection({
  isLinked,
  telegramUsername,
}: {
  isLinked: boolean;
  telegramUsername: string | null;
  notificationsEnabled: boolean;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function generateToken() {
    setLoading(true);
    setError('');
    const result = await createTelegramLinkToken();
    setLoading(false);
    if ('error' in result) {
      setError(result.error);
    } else {
      setToken(result.token);
    }
  }

  async function handleUnlink() {
    if (!confirm('Bạn chắc chắn muốn hủy liên kết Telegram?')) return;
    setLoading(true);
    await unlinkTelegram();
    window.location.reload();
  }

  if (isLinked) {
    return (
      <div>
        <div className="border border-[#6ec070]/40 bg-[#6ec070]/5 p-5 mb-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[#6ec070] text-lg">●</span>
            <div className="font-display text-base uppercase">Đã liên kết</div>
          </div>
          <p className="text-bone-2 text-sm">
            Tài khoản Telegram: <strong className="text-bone">@{telegramUsername ?? 'unknown'}</strong>
          </p>
          <p className="text-concrete text-xs mt-2">
            Bạn sẽ nhận thông báo khi pair được tiếp nhận, verify, lên floor, hoặc bán.
          </p>
        </div>
        <button
          onClick={handleUnlink}
          disabled={loading}
          className="border border-line-strong text-bone-2 py-3 px-6 font-mono text-[11px] tracking-[0.18em] uppercase hover:border-rust hover:text-rust transition-colors disabled:opacity-50"
        >
          Hủy liên kết
        </button>
      </div>
    );
  }

  if (token) {
    return (
      <div className="space-y-5">
        <div className="border border-rust bg-rust/5 p-6">
          <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase mb-3">Mã liên kết của bạn</div>
          <div className="font-mono text-3xl text-bone tracking-widest mb-3 select-all">{token}</div>
          <div className="font-mono text-[10px] text-concrete tracking-[0.1em]">
            Mã hết hạn sau 15 phút
          </div>
        </div>

        <div className="space-y-3 text-sm text-bone-2">
          <div className="flex gap-3"><span className="text-rust font-mono">01</span> Mở Telegram trên điện thoại</div>
          <div className="flex gap-3"><span className="text-rust font-mono">02</span> Tìm bot: <code className="bg-ink-2 px-2 py-1 text-bone">@store16_bot</code> (thay bằng tên bot của bạn)</div>
          <div className="flex gap-3"><span className="text-rust font-mono">03</span> Gửi lệnh: <code className="bg-ink-2 px-2 py-1 text-bone select-all">/link {token}</code></div>
          <div className="flex gap-3"><span className="text-rust font-mono">04</span> Quay lại đây và refresh trang</div>
        </div>

        <button
          onClick={() => setToken(null)}
          className="font-mono text-[10px] text-concrete tracking-[0.18em] uppercase hover:text-bone transition-colors"
        >
          ← Tạo mã khác
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-bone-2 mb-5 leading-[1.55]">
        Liên kết tài khoản Telegram để nhận thông báo realtime mỗi khi có sự kiện quan trọng với pair của bạn:
        được hub tiếp nhận, đã verify, lên floor, có người mua.
      </p>
      <button
        onClick={generateToken}
        disabled={loading}
        className="bg-rust text-ink py-3 px-6 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors disabled:opacity-50"
      >
        {loading ? 'Đang tạo...' : 'Tạo mã liên kết →'}
      </button>
      {error && <div className="mt-3 text-rust font-mono text-[11px]">⚠ {error}</div>}
    </div>
  );
}
