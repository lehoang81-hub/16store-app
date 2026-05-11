import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUser } from '@/lib/queries/current-user'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabase = createServiceClient()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? 'reserved'

    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enrich với lot + buyer + passport identity info
    const enriched = await Promise.all(
      (orders ?? []).map(async (order) => {
        const [{ data: lot }, { data: buyer }, { data: asset }] = await Promise.all([
          supabase
            .from('posts')
            .select('lot_id, brand, model, colorway, size_us, asking_price_vnd, cover_image_url')
            .eq('lot_id', order.lot_id)
            .single(),
          supabase
            .from('users_view')
            .select('id, display_name, telegram_username')
            .eq('id', order.buyer_id)
            .single(),
          // Lấy identity info từ universal_assets
          supabase
            .from('universal_assets')
            .select('id, qr_code, identity_status, security_tier, object_type')
            .eq('id', order.passport_id)
            .maybeSingle(),
        ])
        return { ...order, posts: lot, buyer, asset }
      })
    )

    return NextResponse.json({ orders: enriched })
  } catch (err) {
    console.error('[admin/orders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
