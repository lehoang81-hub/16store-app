'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

interface Order {
  id: string
  lot_id: string
  status: string
  amount_vnd: number
  vietqr_ref: string
  reserved_until: string
  posts: {
    brand: string
    model: string
    colorway: string
    size_us: number
    cover_image_url: string
  } | null
  seller: {
    id: string
    display_name: string
    phone: string | null
    zalo_contact: string | null
  } | null
}

function formatVND(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount)
}

function useCountdown(until: string | null) {
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (!until) return
    const calc = () => {
      const diff = new Date(until).getTime() - Date.now()
      setTimeLeft(Math.max(0, diff))
    }
    calc()
    const interval = setInterval(calc, 1000)
    return () => clearInterval(interval)
  }, [until])

  const mins = Math.floor(timeLeft / 60000)
  const secs = Math.floor((timeLeft % 60000) / 1000)
  return {
    timeLeft,
    display: `${mins}:${secs.toString().padStart(2, '0')}`,
  }
}

export default function CheckoutPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'expired' | 'not_found' | ''>('')

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/orders/${orderId}`)
    if (res.status === 410) {
      setError('expired')
      setLoading(false)
      return
    }
    if (!res.ok) {
      setError('not_found')
      setLoading(false)
      return
    }
    const data = await res.json()
    setOrder(data.order)
    setLoading(false)
  }, [orderId])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  const { timeLeft, display: countdown } = useCountdown(
    order?.reserved_until ?? null
  )

  // Auto redirect khi hết giờ
  useEffect(() => {
    if (timeLeft === 0 && order?.status === 'reserved') {
      const t = setTimeout(() => {
        router.push(`/lot/${order.lot_id}?expired=1`)
      }, 2000)
      return () => clearTimeout(t)
    }
  }, [timeLeft, order, router])

  // VietQR URL
  const BANK_BIN = process.env.NEXT_PUBLIC_BANK_BIN ?? '970422'
  const BANK_ACCOUNT = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NO ?? '0123456789'

  if (loading) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-concrete animate-pulse">
          Đang tải đơn hàng...
        </p>
      </div>
    )
  }

  if (error === 'expired') {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-rust mb-3">
            Đơn hàng hết hạn
          </div>
          <h1 className="font-display text-2xl uppercase text-bone mb-3">
            Thời gian giữ chỗ đã hết
          </h1>
          <p className="text-bone-2 text-sm mb-6 leading-relaxed">
            Lot này đã trở về trạng thái live. Bạn có thể thử mua lại nếu chưa có ai đặt.
          </p>
          <button
            onClick={() => router.back()}
            className="border border-line text-bone-2 px-6 py-3 font-mono text-[11px] tracking-[0.18em] uppercase hover:border-rust hover:text-rust transition-colors"
          >
            ← Quay lại
          </button>
        </div>
      </div>
    )
  }

  if (error === 'not_found' || !order) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center px-4">
        <div className="text-center">
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-concrete mb-3">
            Không tìm thấy đơn hàng
          </p>
          <Link
            href="/"
            className="font-mono text-[11px] text-rust tracking-[0.18em] uppercase hover:text-bone transition-colors"
          >
            ← Về trang chủ
          </Link>
        </div>
      </div>
    )
  }

  const vietqrUrl = `https://img.vietqr.io/image/${BANK_BIN}-${BANK_ACCOUNT}-compact2.png?amount=${order.amount_vnd}&addInfo=${order.vietqr_ref}&accountName=16STORE`
  const isExpiring = timeLeft > 0 && timeLeft < 5 * 60 * 1000
  const isExpired = timeLeft === 0

  return (
    <div className="min-h-screen bg-ink text-bone">

      {/* Top bar */}
      <div className="border-b border-line px-6 py-4 flex items-center justify-between">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-concrete">
          16STORE · Checkout
        </div>
        <Link
          href={`/lot/${order.lot_id}`}
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-bone-2 hover:text-rust transition-colors"
        >
          ← Xem lại lot
        </Link>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* Lot info header */}
        {order.posts && (
          <div>
            <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-1">
              LOT // {order.lot_id}
            </div>
            <h1 className="font-display text-3xl uppercase leading-tight">
              {order.posts.brand} {order.posts.model}
            </h1>
            {order.posts.colorway && (
              <p className="font-serif italic text-rust text-lg mt-1">
                &ldquo;{order.posts.colorway}&rdquo;
              </p>
            )}
            <p className="font-mono text-[11px] text-concrete tracking-[0.14em] uppercase mt-1">
              US {order.posts.size_us}
            </p>
          </div>
        )}

        {/* Countdown */}
        <div className={`border p-4 flex items-center justify-between ${
          isExpired
            ? 'border-concrete bg-concrete/5'
            : isExpiring
            ? 'border-rust bg-rust/5'
            : 'border-line bg-ink-2'
        }`}>
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-concrete mb-1">
              {isExpired ? 'Đã hết giờ' : 'Giữ chỗ còn'}
            </p>
            <p className={`font-['Space_Mono'] text-3xl tabular-nums ${
              isExpired ? 'text-concrete' : isExpiring ? 'text-rust' : 'text-bone'
            }`}>
              {isExpired ? '0:00' : countdown}
            </p>
          </div>
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-concrete text-right leading-relaxed">
            {isExpired
              ? 'Lot đang về live...'
              : 'Sau thời gian này\nlot sẽ trở về live'
            }
          </p>
        </div>

        {/* QR Code block */}
        <div className="border border-line bg-ink-2 p-6">
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-concrete mb-4 text-center">
            Quét mã để chuyển khoản
          </p>

          <div className="flex justify-center mb-5">
            <div className="bg-white p-2 rounded">
              <Image
                src={vietqrUrl}
                alt="VietQR Payment QR Code"
                width={200}
                height={200}
                className="block"
                unoptimized
              />
            </div>
          </div>

          {/* Payment details */}
          <div className="space-y-3 border-t border-line pt-4">
            <div className="flex justify-between items-center">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-concrete">
                Số tiền
              </span>
              <span className="font-['Space_Mono'] text-hazard text-lg font-bold">
                {formatVND(order.amount_vnd)} ₫
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-concrete">
                Nội dung CK
              </span>
              <span className="font-['Space_Mono'] text-bone font-bold tracking-wider">
                {order.vietqr_ref}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-concrete">
                Ngân hàng
              </span>
              <span className="font-mono text-[11px] text-bone-2">
                {process.env.NEXT_PUBLIC_BANK_SHORT_NAME ?? 'MB'}
              </span>
            </div>
          </div>

          {/* Copy ref button */}
          <button
            onClick={() => navigator.clipboard.writeText(order.vietqr_ref)}
            className="w-full mt-4 border border-line text-bone-2 py-2 font-mono text-[10px] tracking-[0.18em] uppercase hover:border-bone hover:text-bone transition-colors"
          >
            Copy nội dung chuyển khoản
          </button>
        </div>

        {/* Seller contact */}
        {order.seller && (
          <div className="border border-line bg-ink-2 p-4">
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-concrete mb-3">
              Liên hệ người bán
            </p>
            <p className="text-bone text-sm mb-2">{order.seller.display_name}</p>
            <div className="flex gap-3 flex-wrap">
              {order.seller.phone && (
                <a
                  href={`tel:${order.seller.phone}`}
                  className="font-mono text-[11px] tracking-[0.14em] uppercase text-rust hover:text-bone transition-colors border border-rust/30 hover:border-bone px-3 py-1.5"
                >
                  Gọi điện
                </a>
              )}
              {order.seller.zalo_contact && (
                <a
                  href={`https://zalo.me/${order.seller.zalo_contact}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] tracking-[0.14em] uppercase text-rust hover:text-bone transition-colors border border-rust/30 hover:border-bone px-3 py-1.5"
                >
                  Zalo
                </a>
              )}
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="border border-line p-4">
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-concrete mb-2">
            Lưu ý quan trọng
          </p>
          <ul className="space-y-1.5">
            <li className="font-mono text-[11px] text-bone-2 leading-relaxed">
              ⚠ Giao dịch <span className="text-bone">không hoàn tiền</span> sau khi admin xác nhận.
            </li>
            <li className="font-mono text-[11px] text-bone-2 leading-relaxed">
              ✓ Admin sẽ xác nhận trong <span className="text-bone">vòng 24h</span> sau khi nhận tiền.
            </li>
            <li className="font-mono text-[11px] text-bone-2 leading-relaxed">
              ✓ Hộ chiếu sẽ <span className="text-bone">tự động chuyển</span> sang tên bạn sau khi confirm.
            </li>
          </ul>
        </div>

      </div>
    </div>
  )
}
