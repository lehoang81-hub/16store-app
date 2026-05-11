import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Các trường gợi ý theo từng loại vật phẩm
const ASSET_TYPE_HINTS: Record<string, string> = {
  sneaker:     'brand, model, colorway, size_us, condition (DS/VNDS/9.5/9/8.5/8), release_year',
  watch:       'brand, model, case_size_mm, material, movement (automatic/quartz/solar), water_resistant_m, condition, year',
  apparel:     'brand, type (áo/quần/jacket), size (XS/S/M/L/XL/XXL), material, gender (male/female/unisex), color, condition',
  gear:        'brand, type (balo/giày leo núi/lều...), weight_kg, capacity_l (nếu có), waterproof (true/false), condition',
  bag:         'brand, model, material, color, size (small/medium/large), condition, year',
  electronics: 'brand, model, storage_gb, color, battery_health_pct, condition, year',
  pet:         'species, breed, age_months, gender, vaccinated (true/false), neutered (true/false), color',
  medical:     'type, brand, model, size, condition, year_manufactured',
  other:       'name, brand, type, condition, year, notes',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { asset_type, image_base64, image_mime, description } = body

    if (!asset_type) {
      return NextResponse.json({ error: 'Missing asset_type' }, { status: 400 })
    }

    const hints = ASSET_TYPE_HINTS[asset_type] ?? ASSET_TYPE_HINTS.other
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `Bạn là chuyên gia định giá và phân loại vật phẩm.
Loại vật phẩm: ${asset_type}
${description ? `Mô tả của người bán: "${description}"` : ''}

Hãy phân tích và trả về JSON với các trường phù hợp cho loại "${asset_type}".
Các trường gợi ý: ${hints}

Chỉ trả về JSON object thuần, không markdown, không giải thích.
Ví dụ cho sneaker: {"brand":"Nike","model":"Air Force 1","colorway":"White","size_us":9,"condition":"DS","release_year":2023}
Ví dụ cho watch: {"brand":"Garmin","model":"Fenix 7","case_size_mm":47,"movement":"solar","water_resistant_m":100,"condition":"9/10"}

Nếu không đủ thông tin để xác định 1 trường, bỏ qua trường đó.`

    const parts: any[] = [{ text: prompt }]

    // Thêm ảnh nếu có
    if (image_base64 && image_mime) {
      parts.push({
        inlineData: {
          mimeType: image_mime,
          data: image_base64,
        }
      })
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.2 },
    })

    const raw = result.response.text()

    // Extract JSON
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) {
      return NextResponse.json({ attributes: {} })
    }

    const attributes = JSON.parse(match[0])
    return NextResponse.json({ attributes })

  } catch (err) {
    console.error('[suggest-attributes]', err)
    return NextResponse.json({ error: 'AI error' }, { status: 500 })
  }
}
