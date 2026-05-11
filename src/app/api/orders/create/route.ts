import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

    const { lotId, sellerId, passportId } = await req.json();
    if (!lotId || !sellerId) return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });

    const supabase = createServiceClient();

    // Lấy buyer profile
    const { data: buyer } = await supabase
      .from('users_view')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();
    if (!buyer) return NextResponse.json({ error: 'Không tìm thấy hồ sơ' }, { status: 404 });

    // Không cho seller tự mua
    if (buyer.id === sellerId) {
      return NextResponse.json({ error: 'Không thể mua vật phẩm của chính mình' }, { status: 400 });
    }

    // Lấy post để check status + giá
    const { data: post } = await supabase
      .from('posts')
      .select('id, lot_id, asking_price_vnd, status, seller_id')
      .eq('lot_id', lotId)
      .single();

    if (!post) return NextResponse.json({ error: 'Không tìm thấy listing' }, { status: 404 });
    if (post.status !== 'live') {
      return NextResponse.json({ error: 'Vật phẩm không còn khả dụng' }, { status: 409 });
    }

    const depositVnd = Math.round(post.asking_price_vnd * 0.3);

    // Generate VietQR ref — format: 16S-{lotId}-{timestamp}
    const vietqrRef = `16S${lotId.replace(/-/g, '').slice(0, 8).toUpperCase()}${Date.now().toString().slice(-6)}`;

    // Tạo order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        lot_id:        lotId,
        buyer_id:      buyer.id,
        seller_id:     sellerId,
        passport_id:   passportId ?? null,
        status:        'pending',
        amount_vnd:    post.asking_price_vnd,
        deposit_vnd:   depositVnd,
        vietqr_ref:    vietqrRef,
        reserved_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 phút
      })
      .select('id')
      .single();

    if (orderErr || !order) {
      console.error('[orders/create]', orderErr);
      return NextResponse.json({ error: 'Không thể tạo đơn hàng' }, { status: 500 });
    }

    // Log status
    await supabase.from('order_status_log').insert({
      order_id:   order.id,
      old_status: null,
      new_status: 'pending',
      changed_by: buyer.id,
      note:       'Buyer tạo đơn hàng',
    });

    // Update post status → reserved
    await supabase
      .from('posts')
      .update({ status: 'reserved' })
      .eq('lot_id', lotId);

    return NextResponse.json({ success: true, orderId: order.id, vietqrRef, depositVnd });

  } catch (err) {
    console.error('[orders/create]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
