import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { passport_id, message } = await req.json()
    if (!passport_id) {
      return NextResponse.json({ error: 'Missing passport_id' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Lấy passport + owner
    const { data: passport } = await supabase
      .from('shoe_passports')
      .select('id, current_owner_id, qr_code, is_lost')
      .eq('id', passport_id)
      .single()

    if (!passport) {
      return NextResponse.json({ error: 'Passport not found' }, { status: 404 })
    }

    // Update is_lost
    await supabase
      .from('shoe_passports')
      .update({
        is_lost: true,
        lost_reported_at: new Date().toISOString(),
        lost_message: message ?? null,
      })
      .eq('id', passport_id)

    // Notify owner qua Telegram (ẩn danh — không lộ người tìm thấy)
    if (passport.current_owner_id) {
      const { data: owner } = await supabase
        .from('users')
        .select('telegram_chat_id, display_name')
        .eq('id', passport.current_owner_id)
        .single()

      if (owner?.telegram_chat_id) {
        const passportUrl = `${process.env.NEXT_PUBLIC_APP_URL}/passport/${passport.qr_code}`
        const msg = [
          `🔍 *Ai đó tìm thấy đôi giày của bạn!*`,
          ``,
          message ? `Tin nhắn: _"${message}"_` : `Họ đã quét QR hộ chiếu của bạn.`,
          ``,
          `🔗 [Xem hộ chiếu](${passportUrl})`,
          ``,
          `_Liên hệ 16Store để được hỗ trợ nhận lại._`,
        ].join('\n')

        await fetch(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: owner.telegram_chat_id,
              text: msg,
              parse_mode: 'Markdown',
            }),
          }
        )
      }
    }

    // Journey Score: 
    try {
      await supabase.rpc('add_journey_score', {
        p_passport_id: passport.id,
        p_points: 10,
        p_reason: 'qr_scan',
        p_metadata: { event: 'lost_found_scan' },
      })
    } catch { /* ignore */ }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[passports/lost]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
