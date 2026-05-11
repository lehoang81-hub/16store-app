// src/lib/social-card/gemini-background.ts
// Gọi Gemini 2.5 Flash Image (Nano Banana) để generate background art

import { GoogleGenAI } from '@google/genai';
import { SOCIAL_CARD_CONFIG } from './config';
import { buildImagePrompt } from './style-prompts';
import type { SocialCardStyle } from './config';

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey ?? '' });

interface BackgroundContext {
  style: SocialCardStyle;
  brand: string;
  model: string;
  colorway: string;
}

interface BackgroundResult {
  imageBuffer: Buffer;
  prompt: string;
  mimeType: string;
}

/**
 * Generate background image for social card via Gemini 2.5 Flash Image.
 * Returns image as Buffer (ready for Sharp).
 *
 * Throws if API fails — caller must handle fallback (e.g. solid color background).
 */
export async function generateBackground(ctx: BackgroundContext): Promise<BackgroundResult> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const prompt = buildImagePrompt(ctx.style, ctx);

  const response = await ai.models.generateContent({
    model: SOCIAL_CARD_CONFIG.MODEL_IMAGE,
    contents: prompt,
    // Gemini 2.5 Flash Image trả về cả text và image parts.
    // Config responseModalities giúp model chắc chắn output image.
    config: {
      responseModalities: ['IMAGE'],
    },
  });

  // Extract image từ response parts
  const parts = response.candidates?.[0]?.content?.parts ?? [];

  for (const part of parts) {
    if (part.inlineData?.data) {
      const buffer = Buffer.from(part.inlineData.data, 'base64');
      return {
        imageBuffer: buffer,
        prompt,
        mimeType: part.inlineData.mimeType ?? 'image/png',
      };
    }
  }

  throw new Error('Gemini response did not contain image data');
}
