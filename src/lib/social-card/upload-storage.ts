// src/lib/social-card/upload-storage.ts
// Upload poster buffer lên Supabase Storage bucket `social-cards`

import { createServiceClient } from '@/lib/supabase/service';
import { SOCIAL_CARD_CONFIG } from './config';

interface UploadResult {
  publicUrl: string;
  path: string;
}

/**
 * Upload poster buffer lên Supabase Storage, trả về public URL.
 *
 * File path format: {passportId}/{cardId}.png
 * Ví dụ: a7b9c3d4-.../sc_abc123def4.png
 */
export async function uploadPoster(
  buffer: Buffer,
  passportId: string,
  cardPublicCode: string,
): Promise<UploadResult> {
  const supabase = createServiceClient();
  const path = `${passportId}/${cardPublicCode}.png`;

  const { error } = await supabase.storage
    .from(SOCIAL_CARD_CONFIG.STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType: 'image/png',
      cacheControl: '31536000', // 1 year — poster content không đổi, cache aggressive
      upsert: true, // overwrite nếu trùng (rare case khi regenerate)
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Lấy public URL (bucket đã set public)
  const { data: urlData } = supabase.storage
    .from(SOCIAL_CARD_CONFIG.STORAGE_BUCKET)
    .getPublicUrl(path);

  return {
    publicUrl: urlData.publicUrl,
    path,
  };
}

/**
 * Delete poster khỏi storage (dùng khi cleanup expired cards).
 */
export async function deletePoster(path: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.storage.from(SOCIAL_CARD_CONFIG.STORAGE_BUCKET).remove([path]);
}
