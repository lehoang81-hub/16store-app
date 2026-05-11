import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendNotification } from '@/lib/telegram/send';

export async function POST(req: NextRequest) {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

    const { passport_id } = await req.json();
    const supabase = createServiceClient();

    const { data: owner } = await supabase
      .from('users_view')
      .select('id, handle')
      .eq('auth_id', authUser.id)
      .single();

    if (!owner) return NextResponse.json({ error: 'Không tìm thấy hồ sơ' }, { status: 404 });

    const { data: asset } = await supabase
      .from('universal_assets')
      .select('id, qr_code, brand, model, owner_id, is_lost, attributes')
      .eq('id', passport_id)
      .single();

    if (!asset || asset.owner_id !== owner.id) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
    }

    // Tắt báo mất
    await supabase
      .from('universal_assets')
      .update({ is_lost: false, transfer_status: 'locked', updated_at: new Date().toISOString() })
      .eq('id', passport_id);

    // Cập nhật log
    await supabase
      .from('lost_recovery_log')
      .update({ status: 'recovered', updated_at: new Date().toISOString() } as never)
      .eq('asset_id', passport_id)
      .eq('status', 'active');

    const attrs    = (asset.attributes as any) ?? {};
    const itemName = `${asset.brand ?? attrs.brand ?? ''} ${asset.model ?? attrs.model ?? ''}`.trim();
    const timeStr  = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    // Auto journal entry
    const foundTimeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    await supabase
      .from('passport_journal')
      .insert({
        passport_id:       passport_id,
        owner_id:          owner.id,
        entry_type:        'other',
        title:             '✅ Tìm lại được',
        content:           `Vật phẩm đã được tìm lại và xác nhận lúc ${foundTimeStr}. Báo mất đã được tắt.`,
        entry_date:        new Date().toISOString().split('T')[0],
        image_urls:        [],
        is_system:         true,
        system_event_type: 'lost_recovered',
        is_public:         true,
      } as never);

    await sendNotification({
      user_id: owner.id,
      event:   'post_verified' as any,
      payload: { type: 'lost_resolved', asset_id: passport_id },
      message:
        `✅ <b>Báo mất đã được tắt!</b>\n\n` +
        `📦 ${itemName}\n` +
        `🔑 ${asset.qr_code}\n` +
        `⏰ ${timeStr}\n\n` +
        `Vật phẩm đã được mở khóa trở lại. Chúc mừng bạn tìm lại được! 🎉`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/passports/found]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
