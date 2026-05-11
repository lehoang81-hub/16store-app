'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Order {
  id: string
  lot_id: string
  status: string
  amount_vnd: number
  vietqr_ref: string
  reserved_until: string | null
  created_at: string
  confirmed_at: string | null
  posts: {
    brand: string
    model: string
    colorway: string
    size_us: number
    cover_image_url: string | null
  } | null
  buyer: {
    id: string
    display_name: string
    phone: string | null
    telegram_username: string | null
  } | null
}

function formatVND(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount)
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.floor(hours / 24)} ngày trước`
}

function CountdownBadge({ until }: { until: string | null }) {
  const [display, setDisplay] = useState('')
  const [urgent, setUrgent] = useState(false)

  useEffect(() => {
    if (!until) return
    const update = () => {
      const diff = new Date(until).getTime() - Date.now()
      if (diff <= 0) { setDisplay('Hết hạn'); setUrgent(true); return }
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setDisplay(`${mins}:${secs.toString().padStart(2, '0')}`)
      setUrgent(diff < 5 * 60 * 1000)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [until])

  if (!until) return null
  return (
    <span className={`font-['Space_Mono'] text-xs ${urgent ? 'text-rust' : 'text-hazard'}`}>
      {display}
    </span>
  )
}

// ── Confirm Modal ──────────────────────────────────────────────
function ConfirmModal({
  order,
  onConfirm,
  onCancel,
  loading,
}: {
  order: Order
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel() }}
    >
      <div
        className="bg-ink-2 border border-line max-w-md w-full p-6"
        style={{ animation: 'slideUp 0.2s ease-out' }}
      >
        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes pop {
            0%   { transform: scale(1); }
            50%  { transform: scale(1.15); }
            100% { transform: scale(1); }
          }
        `}</style>

        {/* Icon */}
        <div className="text-center mb-4">
          <div
            className="text-4xl inline-block"
            style={{ animation: 'pop 0.4s ease-out 0.1s both' }}
          >
            💸
          </div>
        </div>

        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-rust text-center mb-1">
          Xác nhận thanh toán
        </div>
        <h2 className="font-display text-xl uppercase text-bone text-center mb-5">
          Đã nhận tiền chuyển khoản?
        </h2>

        {/* Order summary */}
        <div className="border border-line bg-ink p-4 mb-5 space-y-2">
          <div className="flex justify-between">
            <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-concrete">Lot</span>
            <span className="font-mono text-[11px] text-bone">{order.lot_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-concrete">Nội dung CK</span>
            <span className="font-['Space_Mono'] text-bone text-sm font-bold">{order.vietqr_ref}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-concrete">Số tiền</span>
            <span className="font-['Space_Mono'] text-hazard font-bold">{formatVND(order.amount_vnd)} ₫</span>
          </div>
          {order.buyer && (
            <div className="flex justify-between">
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-concrete">Buyer</span>
              <span className="font-mono text-[11px] text-bone">{order.buyer.display_name}</span>
            </div>
          )}
        </div>

        <p className="font-mono text-[11px] text-bone-2 text-center mb-5 leading-relaxed">
          Hành động này sẽ{' '}
          <span className="text-bone">chuyển passport</span> sang tên buyer
          và{' '}
          <span className="text-bone">gửi Telegram</span> thông báo.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 border border-line text-bone-2 py-3 font-mono text-[11px] tracking-[0.18em] uppercase hover:border-bone hover:text-bone transition-colors disabled:opacity-40"
          >
            Huỷ
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-rust text-ink py-3 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-pulse">Đang xử lý...</span>
            ) : (
              <>Xác nhận ✓</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Success Overlay ────────────────────────────────────────────
function SuccessOverlay({ buyerName }: { buyerName: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.9)' }}
    >
      <div className="text-center" style={{ animation: 'slideUp 0.3s ease-out' }}>
        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50%       { transform: translateY(-12px); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>

        <div
          className="text-6xl mb-4 inline-block"
          style={{ animation: 'bounce 0.6s ease-in-out 0.2s both' }}
        >
          🎉
        </div>

        <h2
          className="font-display text-3xl uppercase text-bone mb-2"
          style={{ animation: 'fadeIn 0.4s ease-out 0.3s both', opacity: 0 }}
        >
          Passport đã chuyển!
        </h2>

        <p
          className="font-mono text-[11px] text-bone-2 tracking-[0.14em]"
          style={{ animation: 'fadeIn 0.4s ease-out 0.5s both', opacity: 0 }}
        >
          {buyerName} đã nhận được thông báo Telegram
        </p>

        <div
          className="mt-6 w-32 h-1 bg-rust mx-auto"
          style={{
            animation: 'fadeIn 0.1s ease-out 0.6s both, shrink 2s linear 0.7s both',
            opacity: 0,
          }}
        />
        <style>{`
          @keyframes shrink {
            from { width: 8rem; }
            to   { width: 0; }
          }
        `}</style>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────
const STATUS_TABS = [
  { key: 'reserved', label: 'Chờ thanh toán' },
  { key: 'paid', label: 'Đã chuyển tiền' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'cancelled', label: 'Đã huỷ' },
]

export default function AdminOrdersPage() {
  const [activeTab, setActiveTab] = useState('reserved')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmingOrder, setConfirmingOrder] = useState<Order | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [successBuyer, setSuccessBuyer] = useState<string | null>(null)

  const fetchOrders = useCallback(async (status: string) => {
    setLoading(true)
    const res = await fetch(`/api/admin/orders?status=${status}`)
    const data = await res.json()
    setOrders(data.orders ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders(activeTab)
  }, [activeTab, fetchOrders])

  async function handleConfirm() {
    if (!confirmingOrder) return
    setConfirmLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${confirmingOrder.id}/confirm`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`Lỗi: ${data.error}`)
        return
      }
      setConfirmingOrder(null)
      setSuccessBuyer(confirmingOrder.buyer?.display_name ?? 'Buyer')
      setTimeout(() => {
        setSuccessBuyer(null)
        fetchOrders(activeTab)
      }, 2800)
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink text-bone">

      {/* Success overlay */}
      {successBuyer && <SuccessOverlay buyerName={successBuyer} />}

      {/* Confirm modal */}
      {confirmingOrder && (
        <ConfirmModal
          order={confirmingOrder}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmingOrder(null)}
          loading={confirmLoading}
        />
      )}

      {/* Header */}
      <div className="border-b border-line px-8 py-5 flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-concrete mb-1">
            Admin · 16Store
          </div>
          <h1 className="font-display text-2xl uppercase">Quản lý Orders</h1>
        </div>
        <Link
          href="/admin/overview"
          className="font-mono text-[10px] tracking-[0.18em] uppercase text-bone-2 hover:text-rust transition-colors"
        >
          ← Overview
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-line px-8 flex gap-0">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`font-mono text-[10px] tracking-[0.18em] uppercase px-5 py-4 border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-rust text-bone'
                : 'border-transparent text-concrete hover:text-bone-2'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        {loading ? (
          <div className="text-center py-20">
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-concrete animate-pulse">
              Đang tải...
            </p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-line">
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-concrete">
              Không có order nào
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="border border-line bg-ink-2 hover:border-bone-2 p-5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">

                  {/* Left */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-rust">
                        LOT {order.lot_id}
                      </span>
                      {order.status === 'reserved' && (
                        <CountdownBadge until={order.reserved_until} />
                      )}
                      <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-concrete">
                        {timeAgo(order.created_at)}
                      </span>
                    </div>

                    {order.posts && (
                      <div className="mb-2">
                        <p className="font-display text-lg uppercase leading-tight">
                          {order.posts.brand} {order.posts.model}
                        </p>
                        <p className="font-mono text-[11px] text-concrete tracking-[0.14em] uppercase">
                          {order.posts.colorway} · US {order.posts.size_us}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-6 flex-wrap">
                      <div>
                        <p className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase mb-0.5">Số tiền</p>
                        <p className="font-['Space_Mono'] text-hazard font-bold">
                          {formatVND(order.amount_vnd)} ₫
                        </p>
                      </div>
                      <div>
                        <p className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase mb-0.5">Nội dung CK</p>
                        <p className="font-['Space_Mono'] text-bone text-sm font-bold tracking-wider">
                          {order.vietqr_ref}
                        </p>
                      </div>
                      {order.buyer && (
                        <div>
                          <p className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase mb-0.5">Buyer</p>
                          <p className="font-mono text-[11px] text-bone-2">
                            {order.buyer.display_name}
                            {order.buyer.telegram_username && (
                              <span className="text-concrete ml-1">
                                @{order.buyer.telegram_username}
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right */}
                  <div className="flex flex-col gap-2 items-end">
                    {(activeTab === 'reserved' || activeTab === 'paid') && (
                      <button
                        onClick={() => setConfirmingOrder(order)}
                        className="bg-rust text-ink px-5 py-3 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors whitespace-nowrap"
                      >
                        Đã nhận tiền ✓
                      </button>
                    )}
                    <Link
                      href={`/checkout/${order.id}`}
                      target="_blank"
                      className="font-mono text-[10px] tracking-[0.14em] uppercase text-concrete hover:text-bone-2 transition-colors"
                    >
                      Xem checkout →
                    </Link>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

