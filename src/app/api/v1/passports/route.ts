import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

// Partner API — cần API key
// POST /api/v1/passports
// Body: { asset_type, asset_metadata, owner_email? }

const VALID_ASSET_TYPES = [
  'sneaker', 'watch', 'apparel', 'gear',      // Thể thao
  'pet', 'robot',                              // Sinh vật/Công nghệ
  'real_estate', 'insurance', 'document',      // Tài chính/Pháp lý
  'prosthetic', 'medical',                     // Y tế
  'bib',                                       // Race BIB
  'other',                                     // Khác
]

export async function POST(req: NextRequest) {
  // Kiểm tra API key từ header
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return NextResponse.json(
    { error: 'Missing API key. Add header: x-api-key' },
    { status: 401 }
  )

  // Validate API key từ platform_settings
  const supabase = createServiceClient()
  const { data: setting } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', `partner_api_key_${apiKey}`)
    .maybeSingle()

  if (!setting) return NextResponse.json(
    { error: 'Invalid API key' },
    { status: 403 }
  )

  // Parse body
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json(
    { error: 'Invalid JSON body' },
    { status: 400 }
  )

  const { asset_type, asset_metadata, owner_email } = body

  // Validate asset_type
  if (!asset_type || !VALID_ASSET_TYPES.includes(asset_type)) {
    return NextResponse.json({
      error: `Invalid asset_type. Must be one of: ${VALID_ASSET_TYPES.join(', ')}`
    }, { status: 400 })
  }

  // Tạo QR code unique
  const qr_code = `${asset_type.toUpperCase()}-${nanoid(8).toUpperCase()}`

  // Tìm owner nếu có email
  let owner_id = null
  if (owner_email) {
    const { data: owner } = await supabase
      .from('users')
      .select('id')
      .eq('email', owner_email)
      .maybeSingle()
    owner_id = owner?.id ?? null
  }

  // Tạo passport
  const { data: passport, error } = await supabase
    .from('shoe_passports')
    .insert({
      qr_code,
      asset_type,
      asset_metadata: asset_metadata ?? {},
      current_owner_id: owner_id,
      status: 'active',
      journey_score: 50, // Born score
      journey_log: [{
        event: 'born',
        score: 50,
        note: `Passport created via Partner API`,
        created_at: new Date().toISOString(),
      }],
    })
    .select('id, qr_code, asset_type, journey_score, created_at')
    .single()

  if (error) return NextResponse.json(
    { error: error.message },
    { status: 500 }
  )

  return NextResponse.json({
    success: true,
    passport: {
      ...passport,
      passport_url: `${process.env.NEXT_PUBLIC_APP_URL}/passport/${passport.qr_code}`,
      qr_image_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${process.env.NEXT_PUBLIC_APP_URL}/passport/${passport.qr_code}`,
    }
  }, { status: 201 })
}
