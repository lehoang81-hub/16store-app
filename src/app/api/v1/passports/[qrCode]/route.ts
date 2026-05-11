import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

// Public API — không cần auth
// GET /api/v1/passports/[qrCode]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ qrCode: string }> }
) {
  const { qrCode } = await params
  const supabase = createServiceClient()

  const { data: passport, error } = await supabase
    .from('shoe_passports')
    .select(`
      id,
      qr_code,
      status,
      asset_type,
      asset_metadata,
      total_scans,
      total_owners,
      journey_score,
      is_lost,
      created_at,
      current_owner_id,
      posts (
        lot_id,
        brand,
        model,
        colorway,
        size_us,
        condition,
        cover_image_url,
        status
      )
    `)
    .eq('qr_code', qrCode)
    .maybeSingle()

  if (error) return NextResponse.json(
    { error: 'Server error' },
    { status: 500 }
  )

  if (!passport) return NextResponse.json(
    { error: 'Passport not found' },
    { status: 404 }
  )

  // Ẩn thông tin nhạy cảm
  const response = {
    qr_code: passport.qr_code,
    status: passport.status,
    asset_type: passport.asset_type,
    asset_metadata: passport.asset_metadata,
    total_scans: passport.total_scans,
    total_owners: passport.total_owners,
    journey_score: passport.journey_score,
    is_lost: passport.is_lost,
    created_at: passport.created_at,
    // Thông tin vật phẩm (nếu là giày)
    item: passport.posts ? {
      lot_id: (passport.posts as any).lot_id,
      brand: (passport.posts as any).brand,
      model: (passport.posts as any).model,
      colorway: (passport.posts as any).colorway,
      size_us: (passport.posts as any).size_us,
      condition: (passport.posts as any).condition,
      cover_image_url: (passport.posts as any).cover_image_url,
      status: (passport.posts as any).status,
    } : null,
  }

  return NextResponse.json({ passport: response })
}
