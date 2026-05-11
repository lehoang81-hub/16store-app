import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUser } from '@/lib/queries/current-user'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId } = await params
    const supabase = createServiceClient()

    // 1. Lấy order
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // 2. Chỉ buyer hoặc seller mới xem được
    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Kiểm tra expired — auto cancel nếu hết giờ
    if (
      order.status === 'reserved' &&
      order.reserved_until &&
      new Date(order.reserved_until) < new Date()
    ) {
      await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancellation_reason: 'Payment timeout — 30 minutes expired',
        })
        .eq('id', order.id)

      await supabase.from('order_status_log').insert({
        order_id: order.id,
        from_status: 'reserved',
        to_status: 'cancelled',
        note: 'Auto-expired on fetch',
      })

      // Trả lot về live
      await supabase
        .from('posts')
        .update({ status: 'live' })
        .eq('lot_id', order.lot_id)

      return NextResponse.json({ error: 'Order expired' }, { status: 410 })
    }

    // 4. Fetch lot info riêng (lot_id là text không có FK thật)
    const { data: lot } = await supabase
      .from('posts')
      .select('lot_id, brand, model, colorway, size_us, asking_price_vnd, cover_image_url')
      .eq('lot_id', order.lot_id)
      .single()

    // 5. Fetch seller info riêng
    const { data: seller } = await supabase
      .from('users')
      .select('id, display_name, phone, zalo_contact')
      .eq('id', order.seller_id)
      .single()

    const enrichedOrder = {
      ...order,
      posts: lot ?? null,
      seller: seller ?? null,
    }

    return NextResponse.json({ order: enrichedOrder })
  } catch (err) {
    console.error('[orders/get]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
