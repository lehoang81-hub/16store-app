import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUser } from '@/lib/queries/current-user'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { orderId } = await params
    const supabase = createServiceClient()

    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (!['reserved', 'paid'].includes(order.status)) {
      return NextResponse.json({ error: `Cannot confirm: ${order.status}` }, { status: 409 })
    }

    const now = new Date().toISOString()

    // 1. Order → confirmed
    await supabase
      .from('orders')
      .update({ status: 'confirmed', confirmed_at: now, confirmed_by: user.id })
      .eq('id', orderId)

    await supabase.from('order_status_log').insert({
      order_id: orderId,
      from_status: order.status,
      to_status: 'confirmed',
      changed_by: user.id,
      note: 'Payment confirmed by admin',
    })

    // 2. Ownership transfer — universal_assets (owner_id, không phải current_owner_id)
    await supabase
      .from('universal_assets')
      .update({ owner_id: order.buyer_id })
      .eq('id', order.passport_id)

    // 3. Ownership history record
    await supabase.from('ownership_history').insert({
      passport_id: order.passport_id,
      owner_id: order.buyer_id,
      owner_handle_snapshot: 'unknown',
      owner_display_name_snapshot: 'unknown',
      acquired_at: now,
      acquisition_type: 'transfer',
      notes: `Bought via order ${orderId}`,
      created_at: now,
      updated_at: now,
    })

    // 4. Update lot → sold
    await supabase
      .from('posts')
      .update({ status: 'sold', sold_at: now })
      .eq('lot_id', order.lot_id)

    // 5. Order → completed
    await supabase
      .from('orders')
      .update({ status: 'completed' })
      .eq('id', orderId)

    await supabase.from('order_status_log').insert({
      order_id: orderId,
      from_status: 'confirmed',
      to_status: 'completed',
      changed_by: user.id,
      note: 'Ownership transferred',
    })

    // 6. Get asset info
    const { data: asset } = await supabase
      .from('universal_assets')
      .select('qr_code, journey_score, identity_status, object_type, attributes')
      .eq('id', order.passport_id)
      .single()

    // 7. Notify buyer
    const { data: buyer } = await supabase
      .from('users_view')
      .select('telegram_chat_id, display_name')
      .eq('id', order.buyer_id)
      .single()

    if (buyer?.telegram_chat_id) {
      const passportUrl = asset?.qr_code
        ? `${process.env.NEXT_PUBLIC_APP_URL}/passport/${asset.qr_code}`
        : null

      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: buyer.telegram_chat_id,
          text: [
            `🎉 *Chúc mừng ${buyer.display_name}!*`,
            ``,
            `Hộ chiếu đã chuyển sang tên bạn.`,
            `📦 *LOT ${order.lot_id}*`,
            `💰 ${new Intl.NumberFormat('vi-VN').format(order.amount_vnd)} ₫`,
            asset?.journey_score ? `✨ Journey Score: *${asset.journey_score} điểm*` : '',
            passportUrl ? `\n🔗 [Xem hộ chiếu](${passportUrl})` : '',
            ``,
            `_Cảm ơn bạn đã tin tưởng 16Store_ 🙏`,
          ].filter(Boolean).join('\n'),
          parse_mode: 'Markdown',
        }),
      })
    }

    // 8. Notify seller
    const { data: seller } = await supabase
      .from('users_view')
      .select('telegram_chat_id')
      .eq('id', order.seller_id)
      .single()

    if (seller?.telegram_chat_id) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: seller.telegram_chat_id,
          text: [
            `💸 *LOT ${order.lot_id} đã bán thành công!*`,
            `💰 ${new Intl.NumberFormat('vi-VN').format(order.amount_vnd)} ₫`,
            `Admin sẽ liên hệ để thanh toán.`,
          ].join('\n'),
          parse_mode: 'Markdown',
        }),
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[confirm]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
