'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface BuyButtonProps {
  lotId: string
  price: number
  status: string
  statusText: string
}

function formatVND(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount)
}

export function BuyButton({ lotId, price, status, statusText }: BuyButtonProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lot_id: lotId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Có lỗi xảy ra, thử lại nhé.')
        setLoading(false)
        return
      }
      router.push(`/checkout/${data.order.id}`)
    } catch {
      setError('Mất kết nối, thử lại nhé.')
      setLoading(false)
    }
  }

  if (status !== 'live') {
    return (
      <div className="w-full mt-6 border border-line-strong text-concrete py-4 text-center font-mono text-[11px] tracking-[0.2em] uppercase">
        {statusText} · Không khả dụng
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full mt-6 bg-rust text-ink py-4 font-mono text-xs font-bold tracking-[0.2em] uppercase hover:bg-bone transition-colors inline-flex items-center justify-center gap-2"
      >
        MUA NGAY →
      </button>

      {/* Warning Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false)
              setError('')
            }
          }}
        >
          <div className="bg-[#1a1a1c] border border-line max-w-sm w-full p-6">

            {/* Header */}
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-rust mb-1">
              Xác nhận mua hàng
            </div>
            <h2 className="font-display text-xl uppercase text-bone mb-4">
              Bạn chắc chưa?
            </h2>

            {/* Price */}
            <div className="border border-line bg-ink p-4 mb-4">
              <div className="font-mono text-[10px] text-bone-2 tracking-[0.18em] uppercase mb-1">
                Số tiền cần chuyển
              </div>
              <div className="font-['Space_Mono'] text-2xl text-rust">
                {formatVND(price)} ₫
              </div>
            </div>

            {/* Warning text */}
            <div className="space-y-2 mb-6">
              <p className="font-mono text-[11px] text-bone-2 leading-relaxed">
                ⚠ Giao dịch{' '}
                <span className="text-bone">không hoàn tiền</span>{' '}
                sau khi admin xác nhận thanh toán.
              </p>
              <p className="font-mono text-[11px] text-bone-2 leading-relaxed">
                ⏱ Bạn có{' '}
                <span className="text-bone">30 phút</span>{' '}
                để chuyển khoản. Sau thời gian này lot sẽ trở về live.
              </p>
              <p className="font-mono text-[11px] text-bone-2 leading-relaxed">
                📋 Vui lòng kiểm tra kỹ ảnh, tình trạng và thông tin trước khi tiếp tục.
              </p>
            </div>

            {/* Error */}
            {error && (
              <p className="font-mono text-[11px] text-rust mb-4">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false)
                  setError('')
                }}
                disabled={loading}
                className="flex-1 border border-line text-bone-2 py-3 font-mono text-[11px] tracking-[0.18em] uppercase hover:border-bone hover:text-bone transition-colors disabled:opacity-40"
              >
                Huỷ
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 bg-rust text-ink py-3 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors disabled:opacity-40 inline-flex items-center justify-center"
              >
                {loading ? (
                  <span className="animate-pulse">Đang xử lý...</span>
                ) : (
                  'Xác nhận →'
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
