// src/lib/social-card/gemini-tagline.ts
// Gọi Gemini 2.5 Flash (text) để sinh tagline từ journey data

import { GoogleGenAI } from '@google/genai';
import { SOCIAL_CARD_CONFIG } from './config';
import { buildTaglinePrompt, type TaglineContext } from './style-prompts';
import type { TaglineLang } from './config';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn('[social-card] GEMINI_API_KEY not set — tagline generation will fail');
}

const ai = new GoogleGenAI({ apiKey: apiKey ?? '' });

/**
 * Generate AI tagline for a passport based on its journey data.
 * Returns plain string tagline. Fallback to template if API fails.
 */
export async function generateTagline(
  lang: TaglineLang,
  ctx: TaglineContext,
): Promise<string> {
  const prompt = buildTaglinePrompt(lang, ctx);

  try {
    const response = await ai.models.generateContent({
      model: SOCIAL_CARD_CONFIG.MODEL_TEXT,
      contents: prompt,
      config: {
        temperature: 0.9, // creative writing
        maxOutputTokens: 120,
      },
    });

    const text = response.text?.trim();

    if (!text) {
      return fallbackTagline(lang, ctx);
    }

    // Clean up: bỏ quotes nếu model trả về có dấu ngoặc kép
    return text.replace(/^["'`]|["'`]$/g, '').trim();
  } catch (error) {
    console.error('[gemini-tagline] Error:', error);
    return fallbackTagline(lang, ctx);
  }
}

/**
 * Fallback tagline khi Gemini API fail.
 * Dùng template dựa trên journey stats.
 */
function fallbackTagline(lang: TaglineLang, ctx: TaglineContext): string {
  const { cityCount, ownerCount, scanCount } = ctx;

  if (lang === 'vi') {
    if (ownerCount >= 3) {
      return `${ownerCount} người chủ. Một đôi giày. Câu chuyện kế tiếp sẽ do bạn viết.`;
    }
    if (cityCount >= 5) {
      return `${cityCount} thành phố, ${scanCount} lần quét. Vẫn còn đi.`;
    }
    return `Một đôi giày. Một ký ức đang được viết tiếp.`;
  }

  if (ownerCount >= 3) {
    return `${ownerCount} owners. One pair. The next chapter's yours to write.`;
  }
  if (cityCount >= 5) {
    return `${cityCount} cities, ${scanCount} scans. Still walking.`;
  }
  return `One pair. A memory still being written.`;
}
