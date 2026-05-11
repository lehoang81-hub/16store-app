'use server';

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const submitPostSchema = z.object({
  brand: z.string().min(2, 'Brand name required'),
  model: z.string().min(2, 'Model name required'),
  condition: z.enum(['DS', 'VNDS', '9_5', '9', '8_5', '8']),
  size_us: z.number().positive('Size required'),
  asking_price_vnd: z.number().int().positive('Price must be positive'),
  colorway: z.string().optional().default(''),
  release_year: z.number().int().min(1980).max(new Date().getFullYear()),
  hub_id: z.string().uuid('Invalid hub ID'),
  seller_id: z.string().uuid('Invalid seller ID'),
});

export type SubmitPostInput = z.infer<typeof submitPostSchema>;

export interface SubmitPostResult {
  success: boolean;
  postId?: string;
  passportId?: string;
  error?: string;
}

function generateLotCode(): string {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const number = Math.floor(100 + Math.random() * 900);
  return `${letter}-${number}`;
}

export async function submitPost(
  input: SubmitPostInput
): Promise<SubmitPostResult> {
  try {
    console.log('[submitPost] Input:', input);

    const validated = submitPostSchema.parse(input);
    console.log('[submitPost] Validation passed');

    const lotCode = generateLotCode();
    console.log('[submitPost] Lot code:', lotCode);

    // Get price settings
    const { data: minSetting } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', '16store.min_post_price_vnd')
      .eq('domain', '16store')
      .single();

    const { data: maxSetting } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', '16store.max_post_price_vnd')
      .eq('domain', '16store')
      .single();

    const minPrice = minSetting ? parseInt(minSetting.value) : 100000;
    const maxPrice = maxSetting ? parseInt(maxSetting.value) : 1000000000;

    if (
      validated.asking_price_vnd < minPrice ||
      validated.asking_price_vnd > maxPrice
    ) {
      throw new Error(
        `Price must be between ${minPrice} and ${maxPrice} VND`
      );
    }

    // 1. Create post
    console.log('[submitPost] Creating post...');
    const { data: postData, error: postError } = await supabase
      .from('posts')
      .insert([
        {
          lot_id: lotCode,
          seller_id: validated.seller_id,
          brand: validated.brand,
          model: validated.model,
          colorway: validated.colorway,
          condition: validated.condition,
          size_us: validated.size_us,
          release_year: validated.release_year,
          asking_price_vnd: validated.asking_price_vnd,
          hub_id: validated.hub_id,
          status: 'draft',
        },
      ])
      .select()
      .single();

    if (postError) {
      console.error('[submitPost] Post error:', postError);
      throw new Error(`Post insert failed: ${postError.message}`);
    }
    if (!postData) throw new Error('Post created but no data returned');

    const postId = postData.id;
    console.log('[submitPost] Post created:', postId);

    // 2. Create shoe_passport
    const passportId = crypto.randomUUID();
    const qrCode = `16S-${lotCode}-${passportId.substring(0, 8).toUpperCase()}`;

    console.log('[submitPost] Creating passport:', passportId, 'QR:', qrCode);
    const { data: passportData, error: passportError } = await supabase
      .from('shoe_passports')
      .insert([
        {
          id: passportId,
          post_id: postId,
          owner_id: validated.seller_id,
          qr_code: qrCode,
          brand: validated.brand,
          model: validated.model,
          colorway: validated.colorway,
          size_us: validated.size_us,
          condition: validated.condition,
          year: validated.release_year,
          is_lost: false,
          asset_metadata: {
            privacy_mode: 'public',
            auto_hide_night: false,
          },
        },
      ])
      .select()
      .single();

    if (passportError) {
      console.error('[submitPost] Passport error:', passportError);
      throw new Error(`Passport insert failed: ${passportError.message}`);
    }
    if (!passportData) throw new Error('Passport created but no data returned');

    console.log('[submitPost] Passport created:', passportId);

   // 3. Create ownership_history
    console.log('[submitPost] Creating ownership_history...');
    const now = new Date().toISOString();
    const { error: ownershipError } = await supabase
      .from('ownership_history')
      .insert([
        {
          passport_id: passportId,
          owner_id: validated.seller_id,
          owner_handle_snapshot: 'unknown',
          owner_display_name_snapshot: 'unknown',
          acquired_at: now,
          acquisition_type: 'first_purchase',
          notes: 'Submitted by seller',
          created_at: now,
          updated_at: now,
        },
      ]);

    if (ownershipError) {
      console.error('[submitPost] Ownership error:', ownershipError);
      throw new Error(
        `Ownership insert failed: ${ownershipError.message}`
      );
    }

    console.log(
      `[submitPost] SUCCESS: Post ${postId}, Passport ${passportId}, Lot ${lotCode}, QR ${qrCode}`
    );

    return {
      success: true,
      postId,
      passportId,
    };
  } catch (err) {
    console.error('[submitPost] ERROR:', err);

    if (err instanceof z.ZodError) {
      const firstError = err.errors[0];
      const msg = `${firstError.path.join('.')}: ${firstError.message}`;
      console.error('[submitPost] Validation:', msg);
      return { success: false, error: msg };
    }

    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function verifyPost(
  postId: string,
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('posts')
      .update({
        status: 'live',
      })
      .eq('id', postId)
      .eq('status', 'draft');

    if (error) throw error;

    console.log(`[verifyPost] Post ${postId} verified`);
    return { success: true };
  } catch (err) {
    console.error('[verifyPost] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function rejectPost(
  postId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('posts')
      .update({
        status: 'rejected',
      })
      .eq('id', postId)
      .eq('status', 'draft');

    if (error) throw error;

    console.log(`[rejectPost] Post ${postId} rejected: ${reason}`);
    return { success: true };
  } catch (err) {
    console.error('[rejectPost] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}