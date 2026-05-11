'use server';

import { regeneratePolishedDescription } from '@/lib/ai/extract-sneaker';

export interface RegenerateInput {
  brand: string;
  model: string;
  colorway: string | null;
  size_us: number | null;
  condition: string;
  release_year: number | null;
  original_caption: string;
}

export async function regenerateDescription(input: RegenerateInput): Promise<{
  success: boolean;
  description?: string;
  error?: string;
}> {
  try {
    const description = await regeneratePolishedDescription(input);
    return { success: true, description };
  } catch (err) {
    console.error('[regenerateDescription]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Không xác định',
    };
  }
}
