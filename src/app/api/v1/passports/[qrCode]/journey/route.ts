import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

// Public API — không cần auth
// GET /api/v1/passports/[qrCode]/journey
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ qrCode: string }> }
) {
  const { qrCode } = await params
  const supabase = createServiceClient()

  // Tìm passport
  const { data: passport } = await supabase
    .from('shoe_passports')
    .select('id, journey_score, journey_log')
    .eq('qr_code', qrCode)
    .maybeSingle()

  if (!passport) return NextResponse.json(
    { error: 'Passport not found' },
    { status: 404 }
  )

  // Lấy scan events (hành trình địa lý)
  const { data: scans } = await supabase
    .from('scan_events')
    .select('scan_type, city, country, location_lat, location_lng, created_at')
    .eq('passport_id', passport.id)
    .eq('is_meaningful', true)
    .order('created_at', { ascending: false })
    .limit(50)

  // Lấy lịch sử chủ nhân
  const { data: owners } = await supabase
    .from('ownership_history')
    .select('transferred_at, transfer_type')
    .eq('passport_id', passport.id)
    .order('transferred_at', { ascending: false })

  return NextResponse.json({
    journey: {
      journey_score: passport.journey_score,
      journey_log: passport.journey_log,
      scans: scans ?? [],
      ownership_transfers: owners?.length ?? 0,
    }
  })
}
