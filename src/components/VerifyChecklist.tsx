'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { verifyPost } from '@/lib/actions/verify-post';

interface Props {
  postId: string;
  lotId: string;
}

type CheckState = {
  stitching: boolean;
  sole: boolean;
  materials: boolean;
  box: boolean;
};

export function VerifyChecklist({ postId, lotId }: Props) {
  const router = useRouter();
  const [checks, setChecks] = useState<CheckState>({
    stitching: false,
    sole: false,
    materials: false,
    box: false,
  });
  const [mode, setMode] = useState<'idle' | 'rejecting'>('idle');
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const allChecked = Object.values(checks).every(Boolean);
  const checkedCount = Object.values(checks).filter(Boolean).length;

  function toggle(key: keyof CheckState) {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleApprove() {
    if (!allChecked) {
      setError('Cần tick đủ 4 bước trước khi approve');
      return;
    }
    setError('');
    setBusy(true);
    const result = await verifyPost({
      post_id: postId,
      verify_stitching: checks.stitching,
      verify_sole: checks.sole,
      verify_materials: checks.materials,
      verify_box: checks.box,
      action: 'approve',
    });
    setBusy(false);
    if (result.success) {
      router.push(`/admin/hub?approved=${lotId}`);
    } else {
      setError(result.error ?? 'Lỗi không xác định');
    }
  }

  async function handleReject() {
    if (rejectReason.length < 10) {
      setError('Lý do cần ít nhất 10 ký tự');
      return;
    }
    setError('');
    setBusy(true);
    const result = await verifyPost({
      post_id: postId,
      verify_stitching: checks.stitching,
      verify_sole: checks.sole,
      verify_materials: checks.materials,
      verify_box: checks.box,
      action: 'reject',
      reject_reason: rejectReason,
    });
    setBusy(false);
    if (result.success) {
      router.push(`/admin/hub?rejected=${lotId}`);
    } else {
      setError(result.error ?? 'Lỗi không xác định');
    }
  }

  const items: { key: keyof CheckState; label: string; desc: string }[] = [
    {
      key: 'stitching',
      label: 'Đường chỉ',
      desc: 'Stitching đều, màu đúng, không lệch. Fake thường có đường chỉ to hơn hoặc màu hơi lệch.',
    },
    {
      key: 'sole',
      label: 'Đế giày',
      desc: 'Pattern outsole + midsole đúng, font chữ in chuẩn, keo dán sạch sẽ.',
    },
    {
      key: 'materials',
      label: 'Chất liệu',
      desc: 'Da/suede/mesh chuẩn với bản chính thức. Smell check (fake thường có mùi keo).',
    },
    {
      key: 'box',
      label: 'Hộp + giấy',
      desc: 'Box đúng spec (Sticker có SKU + size match), giấy lót đầy đủ, tag gốc (nếu có).',
    },
  ];

  return (
    <div className="border border-line bg-ink/40 p-6">
      <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-5 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
        Verify checklist · {checkedCount}/4
      </div>

      {/* Checkbox items */}
      <div className="space-y-3 mb-6">
        {items.map(({ key, label, desc }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            disabled={busy}
            className={`w-full text-left border p-4 transition-colors ${
              checks[key]
                ? 'border-rust bg-rust/10'
                : 'border-line hover:border-bone/50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 w-6 h-6 border-2 flex items-center justify-center font-display text-sm ${
                  checks[key] ? 'border-rust bg-rust text-ink' : 'border-line text-transparent'
                }`}
              >
                {checks[key] ? '✓' : ''}
              </div>
              <div>
                <div className="font-display text-base uppercase tracking-[-0.01em] mb-1">{label}</div>
                <div className="font-body text-xs text-bone/70 leading-[1.55]">{desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 border border-rust bg-rust/10 text-rust font-mono text-[11px]">
          ⚠ {error}
        </div>
      )}

      {/* Reject reason input */}
      {mode === 'rejecting' && (
        <div className="mb-4 border border-hazard bg-hazard/5 p-4">
          <label className="block font-mono text-[10px] text-hazard tracking-[0.18em] uppercase mb-2">
            Lý do từ chối (tối thiểu 10 ký tự)
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            placeholder="VD: Đường chỉ không đều, heel tab dấu hiệu fake, hộp không đúng SKU..."
            className="w-full bg-ink border border-hazard/50 text-bone p-3 font-body text-sm focus:border-hazard focus:outline-none resize-none"
            disabled={busy}
          />
          <div className="mt-2 font-mono text-[10px] text-concrete">{rejectReason.length} ký tự</div>
        </div>
      )}

      {/* Action buttons */}
      {mode === 'idle' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleApprove}
            disabled={!allChecked || busy}
            className="w-full bg-rust text-ink py-4 font-mono text-xs font-bold tracking-[0.22em] uppercase hover:bg-bone transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy
              ? 'Đang xử lý...'
              : allChecked
              ? '✓ APPROVE & Lên Floor'
              : `Tick đủ 4 bước (${4 - checkedCount} còn lại)`}
          </button>
          <button
            type="button"
            onClick={() => setMode('rejecting')}
            disabled={busy}
            className="w-full border border-hazard text-hazard py-3 font-mono text-[11px] tracking-[0.2em] uppercase hover:bg-hazard hover:text-ink transition-colors disabled:opacity-40"
          >
            ✗ Từ chối pair
          </button>
        </div>
      )}

      {mode === 'rejecting' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleReject}
            disabled={busy || rejectReason.length < 10}
            className="w-full bg-hazard text-ink py-4 font-mono text-xs font-bold tracking-[0.22em] uppercase hover:bg-bone transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Đang gửi...' : 'Xác nhận từ chối & thông báo seller'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('idle');
              setRejectReason('');
              setError('');
            }}
            disabled={busy}
            className="w-full border border-line text-bone/70 py-3 font-mono text-[11px] tracking-[0.2em] uppercase hover:text-bone transition-colors"
          >
            ← Quay lại
          </button>
        </div>
      )}

      {/* Info */}
      <div className="mt-5 pt-5 border-t border-line font-mono text-[10px] text-concrete tracking-[0.12em] leading-[1.6]">
        <div>✓ Approve → pair lên floor · Telegram báo seller</div>
        <div>✗ Reject → Seller nhận notification kèm lý do</div>
      </div>
    </div>
  );
}
