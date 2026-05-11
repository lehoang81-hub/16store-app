'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { verifyPost, rejectPost } from '@/lib/actions/verify-post';

interface Post {
  id: string;
  lot_id: string;
  brand: string;
  model: string;
  colorway?: string;
  size_us: number;
  condition: string;
  asking_price_vnd: number;
  created_at: string;
}

interface PostVerificationCardProps {
  post: Post;
}

export function PostVerificationCard({ post }: PostVerificationCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checklist, setChecklist] = useState({
    stitching: false,
    sole: false,
    materials: false,
    box: false,
  });
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const submittedAt = new Date(post.created_at).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const handleVerify = async () => {
    setLoading(true);
    setFeedback(null);

    try {
      const adminId = '11111111-1111-1111-1111-111111111111';
     const result = await verifyPost({
  post_id: post.id,
  action: 'approve',
  verify_stitching: checklist.stitching,
  verify_sole: checklist.sole,
  verify_materials: checklist.materials,
        verify_box: checklist.box,
      });

      if (result.success) {
        setFeedback({
          type: 'success',
          message: `✓ Post ${post.lot_id} verified & going live!`,
        });
        // Refresh page sau 1.5s
        setTimeout(() => {
          router.refresh();
        }, 1500);
      } else {
        setFeedback({
          type: 'error',
          message: (result as any).error || 'Verification failed',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;

    setLoading(true);
    setFeedback(null);

    try {
      const result = await rejectPost(post.id, reason);

      if (result.success) {
        setFeedback({
          type: 'success',
          message: `✓ Post ${post.lot_id} rejected`,
        });
        // Refresh page sau 1.5s
        setTimeout(() => {
          router.refresh();
        }, 1500);
      } else {
        setFeedback({
          type: 'error',
          message: (result as any).error || 'Rejection failed',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded border border-line/50 bg-ink/50 p-6">
      {/* Feedback */}
      {feedback && (
        <div
          className={`mb-4 rounded border px-3 py-2 text-sm font-mono ${
            feedback.type === 'success'
              ? 'border-green-700/50 bg-green-900/20 text-green-200'
              : 'border-red-700/50 bg-red-900/20 text-red-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-mono text-lg font-bold text-bone">
            {post.brand} {post.model}
            {post.colorway && (
              <span className="font-normal text-concrete"> — {post.colorway}</span>
            )}
          </h3>
          <p className="mt-1 text-xs text-concrete">Lot: {post.lot_id}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs uppercase text-hazard">
            Submitted {submittedAt}
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="mb-6 grid grid-cols-4 gap-4 border-y border-line/30 py-4 text-center">
        <div>
          <div className="font-mono text-xs uppercase text-concrete">Condition</div>
          <div className="mt-1 font-bold text-bone">{post.condition}</div>
        </div>
        <div>
          <div className="font-mono text-xs uppercase text-concrete">Size</div>
          <div className="mt-1 font-bold text-bone">{post.size_us} US</div>
        </div>
        <div>
          <div className="font-mono text-xs uppercase text-concrete">Price</div>
          <div className="mt-1 font-bold text-bone">
            {post.asking_price_vnd.toLocaleString()} VND
          </div>
        </div>
        <div>
          <div className="font-mono text-xs uppercase text-concrete">Seller</div>
          <div className="mt-1 font-mono text-xs text-bone">
            {(post as any).seller_id?.substring(0, 8)}...
          </div>
        </div>
      </div>

      {/* Verification Checklist */}
      <div className="mb-6 space-y-2">
        <div className="font-mono text-xs uppercase text-hazard">Verification</div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'stitching', label: 'Stitching' },
            { key: 'sole', label: 'Sole' },
            { key: 'materials', label: 'Materials' },
            { key: 'box', label: 'Box' },
          ].map((item) => (
            <label key={item.key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={checklist[item.key as keyof typeof checklist]}
                onChange={(e) =>
                  setChecklist({
                    ...checklist,
                    [item.key]: e.target.checked,
                  })
                }
                className="h-4 w-4 cursor-pointer accent-rust"
              />
              <span className="text-sm text-concrete">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleVerify}
          disabled={loading}
          className="flex-1 rounded border border-green-700/50 bg-green-900/20 px-4 py-2 font-mono text-sm uppercase text-green-200 transition-colors hover:bg-green-900/30 disabled:opacity-50"
        >
          {loading ? 'Verifying…' : '✓ Verify & Go Live'}
        </button>

        <button
          onClick={handleReject}
          disabled={loading}
          className="rounded border border-red-700/50 bg-red-900/20 px-4 py-2 font-mono text-sm uppercase text-red-200 transition-colors hover:bg-red-900/30 disabled:opacity-50"
        >
          {loading ? 'Rejecting…' : '✕ Reject'}
        </button>
      </div>
    </div>
  );
}