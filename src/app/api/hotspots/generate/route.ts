import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUser } from '@/lib/queries/current-user'

const HOTSPOT_PROMPT = `Phân tích ảnh giày. Trả về JSON array, tối đa 5 điểm. Chỉ JSON thuần túy, không text khác.

Format:
[{"x":0.5,"y":0.3,"label":"Logo","description":"Mo ta ngan"}]

Quy tac: x,y tu 0.0-1.0. label toi da 3 tu. description toi da 10 tu tieng Viet. Chi JSON array, khong markdown.`

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { post_id, image_url } = await req.json()
    if (!post_id || !image_url) {
      return NextResponse.json({ error: 'Missing post_id or image_url' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Verify post tồn tại
    const { data: post } = await supabase
      .from('posts')
      .select('id, cover_image_url')
      .eq('id', post_id)
      .single()

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check đã có hotspot chưa — nếu có thì trả về luôn
    const { data: existing } = await supabase
      .from('hotspots')
      .select('*')
      .eq('post_id', post_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ hotspot: existing, cached: true })
    }

    // Fetch ảnh → base64
    const imageRes = await fetch(image_url)
    if (!imageRes.ok) {
      return NextResponse.json({ error: 'Cannot fetch image' }, { status: 400 })
    }
    const imageBuffer = await imageRes.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')
    const mimeType = imageRes.headers.get('content-type') ?? 'image/jpeg'

    // Gọi Gemini Vision
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Image,
                }
              },
              { text: HOTSPOT_PROMPT }
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          }
        })
      }
    )

    if (!geminiRes.ok) {
      const err = await geminiRes.text()
      console.error('[hotspots] Gemini error:', err)
      return NextResponse.json({ error: 'Gemini API error' }, { status: 500 })
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Parse JSON từ response
    let spots = []
    try {
      const cleaned = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // strip control chars
        .trim()

      // Extract JSON array nếu có text thừa xung quanh
      const match = cleaned.match(/\[[\s\S]*\]/)
      const jsonStr = match ? match[0] : cleaned

      spots = JSON.parse(jsonStr)

      // Validate format
      if (!Array.isArray(spots)) throw new Error('Not an array')
      spots = spots.filter((s: any) =>
        typeof s.x === 'number' &&
        typeof s.y === 'number' &&
        typeof s.label === 'string' &&
        typeof s.description === 'string' &&
        s.x >= 0 && s.x <= 1 &&
        s.y >= 0 && s.y <= 1
      ).slice(0, 8) // max 8 spots
    } catch (e) {
      console.error('[hotspots] JSON parse error:', e, rawText)
      return NextResponse.json({ error: 'Failed to parse Gemini response' }, { status: 500 })
    }

    if (spots.length === 0) {
      return NextResponse.json({ error: 'No valid hotspots found' }, { status: 422 })
    }

    // Lưu vào DB
    const { data: hotspot, error: insertError } = await supabase
      .from('hotspots')
      .insert({
        post_id,
        generated_by: user.id,
        image_url,
        spots,
        model_used: 'gemini-2.5-flash',
      })
      .select()
      .single()

    if (insertError) {
      console.error('[hotspots] insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ hotspot, cached: false })
  } catch (err) {
    console.error('[hotspots/generate]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const post_id = searchParams.get('post_id')
    if (!post_id) {
      return NextResponse.json({ error: 'Missing post_id' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data: hotspot } = await supabase
      .from('hotspots')
      .select('*')
      .eq('post_id', post_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ hotspot: hotspot ?? null })
  } catch (err) {
    console.error('[hotspots/get]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
