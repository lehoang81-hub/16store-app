'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Order {
  id: string
  lot_id: string
  status: string
  amount_vnd: number
  vietqr_ref: string
  reserved_until: string | null
  created_at: string
  posts: {
    brand: string
    model: string
    colorway: string
    size_us: number
  } | null
  passport: {
    id: string
    qr_code: string
    total_scans: number
  } | null
}

function formatVND(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount)
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  reserved: { label: 'Chờ thanh toán', color: 'text-hazard', bg: 'border-hazard/30 bg-hazard/5' },
  paid: { label: 'Đã chuyển tiền', color: 'text-[#6ec070]', bg: 'border-[#6ec070]/30 bg-[#6ec070]/5' },
  confirmed: { label: 'Đang xác nhận', color: 'text-hazard', bg: 'border-hazard/30 bg-hazard/5' },
  completed: { label: 'Hoàn thành', color: 'text-[#6ec070]', bg: 'border-[#6ec070]/30 bg-[#6ec070]/5' },
  cancelled: { label: 'Đã huỷ', color: 'text-concrete', bg: 'border-line bg-ink' },
}

function CountdownBadge({ until }: { until: string }) {
  const [display, setDisplay] = useState('')
  const [urgent, setUrgent] = useState(false)

  useEffect(() => {
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

  return (
    <span className={`font-['Space_Mono'] text-sm ${urgent ? 'text-rust' : 'text-hazard'}`}>
      {display}
    </span>
  )
}

function OrderCard({ order }: { order: Order }) {
  const statusCfg = STATUS_CONFIG[order.status] ?? {
    label: order.status, color: 'text-bone-2', bg: 'border-line',
  }

  return (
    <div className={`border p-5 ${statusCfg.bg}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-rust">
              LOT {order.lot_id}
            </span>
            <span className={`font-mono text-[10px] tracking-[0.14em] uppercase ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>

          {order.posts && (
            <div className="mb-3">
              <p className="font-display text-lg uppercase leading-tight">
                {order.posts.brand} {order.posts.model}
              </p>
              <p className="font-serif italic text-rust">
                &ldquo;{order.posts.colorway}&rdquo;
              </p>
              <p className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase mt-0.5">
                US {order.posts.size_us}
              </p>
            </div>
          )}

          <div className="flex items-center gap-5 flex-wrap">
            <div>
              <p className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase mb-0.5">Số tiền</p>
              <p className="font-['Space_Mono'] text-hazard font-bold">
                {formatVND(order.amount_vnd)} ₫
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase mb-0.5">Mã CK</p>
              <p className="font-['Space_Mono'] text-bone text-sm font-bold">
                {order.vietqr_ref}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase mb-0.5">Ngày đặt</p>
              <p className="font-mono text-[11px] text-bone-2">
                {new Date(order.created_at).toLocaleDateString('vi-VN')}
              </p>
            </div>
          </div>

          {order.status === 'reserved' && order.reserved_until && (
            <div className="mt-3 flex items-center gap-2">
              <span className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase">Còn lại:</span>
              <CountdownBadge until={order.reserved_until} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 items-end">
          {order.status === 'reserved' && (
            <Link
              href={`/checkout/${order.id}`}
              className="bg-rust text-ink px-4 py-2.5 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors whitespace-nowrap"
            >
              Thanh toán →
            </Link>
          )}
          {order.status === 'completed' && order.passport && (
            <Link
              href={`/passport/${order.passport.qr_code}`}
              className="bg-rust text-ink px-4 py-2.5 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors whitespace-nowrap"
            >
              Xem hộ chiếu →
            </Link>
          )}
          <Link
            href={`/lot/${order.lot_id}`}
            className="font-mono text-[10px] tracking-[0.14em] uppercase text-concrete hover:text-bone-2 transition-colors"
          >
            Xem lot →
          </Link>
        </div>
      </div>
    </div>
  )
}

export function BuyerOrdersList() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/buyer/orders')
      .then((r) => r.json())
      .then((d) => { setOrders(d.orders ?? []); setLoading(false) })
  }, [])

  const activeOrders = orders.filter((o) => ['reserved', 'paid', 'confirmed'].includes(o.status))
  const completedOrders = orders.filter((o) => o.status === 'completed')
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled')

  if (loading) {
    return (
      <div className="text-center py-20">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-concrete animate-pulse">
          Đang tải...
        </p>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="border border-dashed border-line p-12 text-center">
        <p className="font-display text-xl uppercase text-concrete mb-2">Chưa có đơn hàng nào</p>
        <p className="font-mono text-[11px] text-concrete mb-6">Khám phá các pair đang mở bán trên Floor</p>
        <Link
          href="/#floor"
          className="bg-rust text-ink px-6 py-3 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors"
        >
          Xem Floor →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {activeOrders.length > 0 && (
        <section>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-rust mb-4 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Đang xử lý · {activeOrders.length}
          </div>
          <div className="space-y-3">
            {activeOrders.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        </section>
      )}

      {completedOrders.length > 0 && (
        <section>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#6ec070] mb-4 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-[#6ec070]">
            Hoàn thành · {completedOrders.length}
          </div>
          <div className="space-y-3">
            {completedOrders.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        </section>
      )}

      {cancelledOrders.length > 0 && (
        <section>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-concrete mb-4 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-concrete">
            Đã huỷ · {cancelledOrders.length}
          </div>
          <div className="space-y-3 opacity-60">
            {cancelledOrders.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        </section>
      )}
    </div>
  )
}
