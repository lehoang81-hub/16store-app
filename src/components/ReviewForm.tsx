'use client'

import { useState } from 'react'

interface ReviewFormProps {
  orderId: string
  sellerId: string
  sellerHandle: string
  onDone?: () => void
}

export function ReviewForm({ orderId, sellerId, sellerHandle, onDone }: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [platformRating, setPlatformRating] = useState(0)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!rating) return
    setLoading(true)
    setError('')

    try {
      // Review buyer → seller
      const r1 = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          review_type: 'buyer_to_seller',
          rating,
          comment: comment.trim() || null,
        }),
      })

      // Review buyer → platform (nếu có)
      if (platformRating > 0) {
        await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderId,
            review_type: 'buyer_to_platform',
            rating: platformRating,
          }),
        })
      }

      if (!r1.ok) {
        const d = await r1.json()
        setError(d.error ?? 'Có lỗi xảy ra')
        return
      }

      setDone(true)
      onDone?.()
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="border border-[#6ec070]/30 bg-[#6ec070]/5 p-4 text-center">
        <div className="text-2xl mb-2">⭐</div>
        <p className="font-mono text-[11px] text-[#6ec070] tracking-[0.14em] uppercase">
          Cảm ơn bạn đã đánh giá!
        </p>
      </div>
    )
  }

  return (
    <div className="border border-line p-5 space-y-5">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-rust flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
        Đánh giá giao dịch
      </div>

      {/* Rating seller */}
      <div>
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-concrete mb-2">
          Người bán @{sellerHandle}
        </p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className={`text-2xl transition-transform hover:scale-110 ${
                star <= rating ? 'opacity-100' : 'opacity-30'
              }`}
            >
              ⭐
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Nhận xét về người bán (tuỳ chọn)..."
          rows={3}
          maxLength={300}
          className="w-full bg-ink border border-line text-bone text-sm p-3 font-mono resize-none focus:outline-none focus:border-bone-2 placeholder:text-concrete"
        />
        <div className="font-mono text-[9px] text-concrete text-right mt-1">
          {comment.length}/300
        </div>
      </div>

      {/* Rating platform */}
      <div>
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-concrete mb-2">
          Trải nghiệm 16Store (tuỳ chọn)
        </p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setPlatformRating(star)}
              className={`text-xl transition-transform hover:scale-110 ${
                star <= platformRating ? 'opacity-100' : 'opacity-20'
              }`}
            >
              ⭐
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="font-mono text-[11px] text-rust">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!rating || loading}
        className="w-full bg-rust text-ink py-3 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors disabled:opacity-40"
      >
        {loading ? 'Đang gửi...' : 'Gửi đánh giá →'}
      </button>
    </div>
  )
}
