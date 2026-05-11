import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUser } from '@/lib/queries/current-user'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Enrich với lot + passport + seller info
    const enriched = await Promise.all(
      (orders ?? []).map(async (order) => {
        const [{ data: lot }, { data: passport }, { data: seller }] = await Promise.all([
          supabase
            .from('posts')
            .select('lot_id, brand, model, colorway, size_us, cover_image_url')
            .eq('lot_id', order.lot_id)
            .single(),
          supabase
            .from('shoe_passports')
            .select('id, qr_code, total_scans')
            .eq('id', order.passport_id)
            .single(),
          supabase
            .from('users')
            .select('id, display_name, handle')
            .eq('id', order.seller_id)
            .single(),
        ])
        return { ...order, posts: lot, passport, seller }
      })
    )

    return NextResponse.json({ orders: enriched })
  } catch (err) {
    console.error('[buyer/orders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
