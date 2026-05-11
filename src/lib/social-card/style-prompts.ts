// src/lib/social-card/style-prompts.ts
// v4 — Tagline prompt: 2 câu HOÀN CHỈNH bắt buộc

import type { SocialCardStyle } from './config';

interface PromptContext { brand: string; model: string; colorway: string; }

export function buildImagePrompt(style: SocialCardStyle, ctx: PromptContext): string {
  const { brand, model, colorway } = ctx;
  const subject = `${brand} ${model} sneakers in ${colorway} colorway`;

  const compositionRules = `
MANDATORY COMPOSITION RULES:
- Sneakers placed in the BOTTOM THIRD of frame (y 65%-95%).
- Top two-thirds (y 0%-65%): atmospheric negative space, minimal detail.
- NO text, NO logos, NO watermarks, NO characters, NO letters anywhere in the image.
- Vertical portrait 4:5 aspect ratio.`;

  switch (style) {
    case 'editorial': return `Editorial fashion archive photograph. ${subject} placed on weathered concrete or industrial surface in the bottom of frame.
Setting: Abandoned industrial warehouse at dusk. Rust-tinged metal beams, exposed brick walls, golden hour light filtering through high windows. Deep shadows.
Lighting: Single warm amber key light from upper-left, dramatic chiaroscuro. Film grain texture, slight vignette.
Color: Dark charcoal (#141416), bone white highlights, rust orange accents (#c8531c).
Camera: Medium format film, 35mm lens equivalent, low angle, shallow depth of field. Archival editorial.
${compositionRules}`;

    case 'street': return `Urban night photography, cyberpunk street aesthetic. ${subject} on wet asphalt pavement in the bottom of frame.
Setting: Rain-soaked urban alleyway at midnight. Graffiti-tagged concrete walls, steam from manholes, neon signs above casting reflections.
Lighting: Electric cyan and hot magenta neon reflections on wet surfaces, deep black void shadows.
Camera: 35mm film, ISO 1600 grain, handheld. Gritty analog. Absolutely NO Japanese, Korean or any text characters visible.
${compositionRules}`;

    case 'archive': return `Pure white museum curation photograph. ${subject} floating in the LOWER portion of a pure white cyclorama.
Setting: Perfect white seamless studio background. Zero texture, zero objects, zero distractions.
Lighting: Soft omnidirectional studio light, zero shadows except subtle drop shadow directly beneath shoes. Clinical, razor-sharp.
Style: Museum artifact presentation. Virgil Abloh "Figures of Speech" MCA exhibition aesthetic.
Camera: 85mm lens, eye-level, clean. The top 60% of frame should be pure white/empty space.
${compositionRules}`;
  }
}

export interface TaglineContext {
  brand: string; model: string; colorway: string;
  cityCount: number; scanCount: number; ownerCount: number;
  daysOwned: number; citiesList?: string[];
}

export function buildTaglinePrompt(lang: 'vi' | 'en', ctx: TaglineContext): string {
  const { brand, model, colorway, cityCount, scanCount, ownerCount, daysOwned, citiesList } = ctx;
  const topCities = citiesList?.slice(0, 3).join(', ') || '';

  if (lang === 'vi') {
    return `Bạn là copywriter cho 16Store — "A Memory Store" — platform về ký ức của vật thể.

Dữ liệu sneaker này:
- Tên: ${brand} ${model} (${colorway})
- ${ownerCount} chủ đã sở hữu
- ${scanCount} lần scan QR
- ${cityCount} thành phố đã đến${topCities ? ` (bao gồm: ${topCities})` : ''}
- Đã tồn tại ${daysOwned} ngày

NHIỆM VỤ: Viết ĐÚNG 2 CÂU tiếng Việt, mỗi câu phải HOÀN CHỈNH về ngữ nghĩa.

QUY TẮC BẮT BUỘC:
✅ Câu 1: Kể về hành trình cụ thể (thành phố, thời gian, chủ nhân)
✅ Câu 2: Cảm xúc hiện tại hoặc mở ra tương lai
✅ Mỗi câu kết thúc bằng DẤU CHẤM (.) hoặc DẤU CHẤM THAN (!)
✅ Tổng cộng 14-24 từ
✅ Giọng điện ảnh, hoài niệm, có hồn

❌ KHÔNG kết thúc câu bằng dấu phẩy (,)
❌ KHÔNG bỏ lửng giữa câu
❌ KHÔNG viết câu chưa hoàn chỉnh
❌ KHÔNG dùng emoji, từ thương mại, sáo rỗng

VÍ DỤ CÁC CÂU HỢP LỆ:
• "Từ Hà Nội đến Tokyo, mười hai thành phố đã in dấu. Vẫn còn đi."
• "Ba người chủ, một đôi giày, vô số ký ức. Câu chuyện kế tiếp là của bạn."
• "Hai mươi mốt lần quét, mười hai thành phố. Chưa bao giờ nghỉ bước."

VÍ DỤ CÁC CÂU KHÔNG HỢP LỆ (ĐỪNG VIẾT NHƯ NÀY):
• "Hai chủ," ← kết thúc bằng dấu phẩy — SAI
• "Chín ngày," ← câu dở dang — SAI
• "Hành trình dài" ← không có dấu câu cuối — SAI

TRẢ VỀ DUY NHẤT 2 CÂU TAGLINE. Không giải thích, không ngoặc kép bao ngoài.`;
  }

  return `You are a copywriter for 16Store — "A Memory Store" — a platform about the memory of objects.

Sneaker data:
- Name: ${brand} ${model} (${colorway})
- ${ownerCount} owner(s)
- ${scanCount} QR scans
- ${cityCount} cities visited${topCities ? ` (including: ${topCities})` : ''}
- ${daysOwned} days old

TASK: Write EXACTLY 2 COMPLETE English sentences.

MANDATORY RULES:
✅ Sentence 1: Tell about the specific journey (cities, time, owners)
✅ Sentence 2: Current emotion or open the future
✅ Each sentence MUST end with PERIOD (.) or EXCLAMATION (!)
✅ Total 14-22 words
✅ Cinematic, nostalgic, soulful tone

❌ NEVER end a sentence with a comma (,)
❌ NEVER trail off mid-sentence
❌ NEVER write incomplete sentences
❌ No emoji, no commercial words, no clichés

VALID EXAMPLES:
• "From Hanoi to Tokyo, twelve cities. Still walking."
• "Three owners, one pair, countless memories. The next chapter is yours."
• "Twenty-one scans, twelve cities. Never once stopped."

INVALID EXAMPLES (DO NOT write like this):
• "Two owners," ← ends with comma — WRONG
• "Nine days," ← incomplete — WRONG

RETURN ONLY the 2-sentence tagline. No explanation, no surrounding quotes.`;
}
