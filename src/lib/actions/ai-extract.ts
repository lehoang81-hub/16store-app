'use server';

import { extractSneakerFromImage, type ExtractedSneaker } from '@/lib/ai/extract-sneaker';

export interface AiExtractResult {
  success: boolean;
  data?: ExtractedSneaker;
  error?: string;
}

/**
 * Nhận base64 image + caption, gọi Gemini extract, trả về structured data.
 */
export async function aiExtractSneaker(input: {
  imageBase64: string;
  mimeType: string;
  caption: string;
}): Promise<AiExtractResult> {
  try {
    if (!input.imageBase64) {
      return { success: false, error: 'Cần có ảnh' };
    }

    const data = await extractSneakerFromImage(
      input.imageBase64,
      input.mimeType,
      input.caption
    );

    return { success: true, data };
  } catch (err) {
    console.error('[aiExtractSneaker]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Không xác định',
    };
  }
}
