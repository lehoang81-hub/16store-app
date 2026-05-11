import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUser } from '@/lib/queries/current-user'

// Tạo mã VietQR ref duy nhất: 16S + timestamp + random
function generateVietQRRef(): string {
  const ts = Date.now().toString().slice(-6)
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `16S${ts}${rand}`
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { lot_id } = await req.json()
    if (!lot_id) {
      return NextResponse.json({ error: 'Missing lot_id' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 1. Lấy thông tin lot
    const { data: lot, error: lotError } = await supabase
      .from('posts')
      .select('id, lot_id, seller_id, asking_price_vnd, status')
      .eq('lot_id', lot_id)
      .single()

    if (lotError || !lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 })
    }

    if (lot.status !== 'live') {
      return NextResponse.json({ error: 'Lot is not available' }, { status: 409 })
    }

    if (lot.seller_id === user.id) {
      return NextResponse.json({ error: 'Cannot buy your own lot' }, { status: 400 })
    }

    // 2. Kiểm tra không có order reserved/paid/confirmed nào đang tồn tại
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('lot_id', lot_id)
      .in('status', ['reserved', 'paid', 'confirmed'])
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Lot is currently reserved' }, { status: 409 })
    }

    // 3. Lấy passport liên kết với lot này
    const { data: passport } = await supabase
      .from('shoe_passports')
      .select('id')
      .eq('current_post_id', lot.id)
      .maybeSingle()

    if (!passport) {
      return NextResponse.json({ error: 'Passport not found for this lot' }, { status: 404 })
    }

    const vietqr_ref = generateVietQRRef()
    const reserved_until = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    // 4. Tạo order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        lot_id: lot_id,
        buyer_id: user.id,
        seller_id: lot.seller_id,
        passport_id: passport.id,
        status: 'reserved',
        amount_vnd: lot.asking_price_vnd,
        vietqr_ref,
        reserved_until,
      })
      .select()
      .single()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    // 5. Ghi status log
    await supabase.from('order_status_log').insert({
      order_id: order.id,
      from_status: 'pending',
      to_status: 'reserved',
      changed_by: user.id,
      note: 'Order created by buyer',
    })

    // 6. Đổi status lot → reserved
    await supabase
      .from('posts')
      .update({ status: 'reserved' })
      .eq('lot_id', lot_id)

    return NextResponse.json({ order })
  } catch (err) {
    console.error('[orders/create]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
