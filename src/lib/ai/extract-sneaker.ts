import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { z } from 'zod';

// ─── Schema kết quả AI trả về ──────────────────────────────────────
export const ExtractedSneakerSchema = z.object({
  brand: z.string(),
  model: z.string(),
  colorway: z.string().nullable(),
  size_us: z.number().min(4).max(15).nullable(),
  condition_guess: z.enum(['DS', 'VNDS', '9_5', '9', '8_5', '8']).nullable(),
  release_year_guess: z.number().int().min(1985).max(2030).nullable(),
  estimated_price_vnd: z.number().int().positive().nullable(),
  strategy_advice: z.string().max(800),
  polished_description: z.string().max(1200),
  confidence: z.number().min(0).max(1),
  risk_flags: z.array(z.string()),
});

export type ExtractedSneaker = z.infer<typeof ExtractedSneakerSchema>;

// Schema dạng Gemini structured output
const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    brand: { type: SchemaType.STRING },
    model: { type: SchemaType.STRING },
    colorway: { type: SchemaType.STRING, nullable: true },
    size_us: { type: SchemaType.NUMBER, nullable: true },
    condition_guess: {
      type: SchemaType.STRING,
      enum: ['DS', 'VNDS', '9_5', '9', '8_5', '8'],
      nullable: true,
    },
    release_year_guess: { type: SchemaType.NUMBER, nullable: true },
    estimated_price_vnd: { type: SchemaType.NUMBER, nullable: true },
    strategy_advice: { type: SchemaType.STRING },
    polished_description: { type: SchemaType.STRING },
    confidence: { type: SchemaType.NUMBER },
    risk_flags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['brand', 'model', 'strategy_advice', 'polished_description', 'confidence', 'risk_flags'],
};

const SYSTEM_PROMPT = `Bạn là Cố vấn xác thực sneaker của 16Store — sàn ký gửi sneaker cao cấp tại Việt Nam.

Khi nhận được ảnh giày + mô tả ngắn từ người ký gửi, hãy thực hiện 4 việc:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. NHẬN DIỆN CHÍNH XÁC (extraction)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Brand: Air Jordan, Nike, Nike SB, Adidas, Yeezy, New Balance, Travis Scott, ...
- Model đầy đủ: VD "AJ4 Bred Reimagined", "SB Dunk Low Panda", "NB 990v3 Steel Blue"
- Colorway: tên phối màu chính thức nếu nhận ra
- Size US (in trên lưỡi gà, hộp): nếu thấy
- Tình trạng: DS / VNDS / 9_5 / 9 / 8_5 / 8
- Năm release nếu nhận ra
- Giá tham chiếu thị trường VN (VNĐ)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. HIẾN KẾ CHIẾN LƯỢC (strategy_advice)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ngắn gọn, thực tế, tiếng Việt. 2-3 câu. Không flowery.
Ví dụ: "Pair này có giá vintage cao vì đã discontinued. Nên highlight OG box và deubre trong ảnh. Post timing tốt là cuối tuần."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. VIẾT MÔ TẢ CHAU CHUỐT (polished_description) — QUAN TRỌNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dựa trên caption của seller + thông tin bạn vừa extract, viết lại thành mô tả bán hàng TINH TẾ theo phong cách:

• **Kith / Dover Street Market** — boutique cao cấp, có chất editorial
• **Storytelling + cảm xúc** — không khô khan như Christie's, không cộc lộc như Grailed
• **Tiếng Việt nhưng có keyword tiếng Anh đúng** — "Deadstock", "grail", "OG box" giữ nguyên

QUY TẮC BẮT BUỘC:
✓ 3-5 câu, tổng cộng 80-150 từ
✓ GIỮ NGUYÊN sự thật trong caption gốc (không bịa thêm)
✓ Có cấu trúc: mở bằng narrative → middle kể đặc điểm → kết bằng spec tóm tắt
✓ Kết thúc bằng 3 dòng spec ngắn gọn, format:
    Size: [size EU/US]
    Tình trạng: [condition] ([tên đầy đủ])
    Năm phát hành: [year] (nếu có)

✗ KHÔNG viết "hãy mua ngay", "siêu hot", "giá tốt", "deal thơm", "inbox để giữ giá"
✗ KHÔNG dùng emoji
✗ KHÔNG dùng exclamation marks (!) quá 1 lần
✗ KHÔNG over-hype — người mua 16Store là collector có gu, ghét hype
✗ Không tag hashtag (#authentic, #sneakerhead)

VÍ DỤ TỐT:
Caption gốc: "moi mua, size 42, di duoc 1 thang, hien con rat moi"
Mô tả chau chuốt:
"Một tháng đồng hành, không phải một năm hao mòn. Đôi AJ4 Bred Reimagined này vừa rời khỏi kệ trưng bày của chủ nhân đầu tiên, được đi đúng ba lần trong thời tiết khô, box còn, giấy lót còn nguyên. Phối màu Bred 2024 — bản tái diễn giải sau hai thập kỷ — được giới collector gọi là 'đợi lâu hơn ta tưởng'. Dành cho người hiểu rằng timing quyết định giá trị.

Size: 42 EU / 9.5 US
Tình trạng: VNDS (Very Near Deadstock)
Năm phát hành: 2024"

VÍ DỤ XẤU (đừng làm):
"AJ4 Bred Reimagined mới tinh! Đã đi 1 tháng nên còn rất mới. Size 42. Giá tốt, ai quan tâm inbox 👟🔥"
→ Quá sale-sy, cộc lộc, có emoji, không có narrative.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. CONFIDENCE + RISK FLAGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- confidence: 0.9+ rõ nét và phổ biến, 0.7-0.9 khá, <0.5 không chắc
- risk_flags: mảng strings từ danh sách:
  "blurry_image", "suspicious_authenticity", "unusual_colorway",
  "missing_box", "single_shoe_only", "price_too_low", "missing_info"

Trả về JSON đúng schema.`;

export async function extractSneakerFromImage(
  imageBase64: string,
  mimeType: string,
  userCaption: string
): Promise<ExtractedSneaker> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY chưa được cấu hình');

  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: responseSchema as never,
      temperature: 0.7, // cao hơn chút để polished_description sáng tạo
    },
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await model.generateContent([
    { inlineData: { data: imageBase64, mimeType } },
    { text: `Mô tả từ người ký gửi: ${userCaption || '(không có mô tả)'}` },
  ]);

  const raw = JSON.parse(result.response.text());
  return ExtractedSneakerSchema.parse(raw);
}

/**
 * Chỉ sinh polished_description mới — dùng khi user đã sửa form và muốn "Viết lại"
 * Không extract lại info (nhanh hơn, ít token hơn).
 */
export async function regeneratePolishedDescription(params: {
  brand: string;
  model: string;
  colorway: string | null;
  size_us: number | null;
  condition: string;
  release_year: number | null;
  original_caption: string;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY chưa được cấu hình');

  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.9, // cao hơn để "viết lại" có variation
    },
    systemInstruction: SYSTEM_PROMPT,
  });

  const userPrompt = `
Hãy viết LẠI mô tả chau chuốt cho pair sneaker sau đây (chỉ trả về text mô tả, không JSON):

Thông tin đã xác minh:
- Brand: ${params.brand}
- Model: ${params.model}
- Colorway: ${params.colorway ?? 'không rõ'}
- Size US: ${params.size_us ?? 'không rõ'}
- Tình trạng: ${params.condition}
- Năm phát hành: ${params.release_year ?? 'không rõ'}

Caption gốc của seller: "${params.original_caption || '(không có)'}"

Viết lại theo đúng yêu cầu trong system prompt (3-5 câu, 80-150 từ, kết thúc bằng 3 dòng spec).
CHỈ trả về text mô tả, không giải thích gì thêm.
`;

  const result = await model.generateContent(userPrompt);
  return result.response.text().trim();
}
