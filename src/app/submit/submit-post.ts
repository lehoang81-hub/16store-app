'use server';

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Zod schema cho submit post
 */
const submitPostSchema = z.object({
  brand: z.string().min(2, 'Brand name required'),
  model: z.string().min(2, 'Model name required'),
  condition: z.enum(['DS', 'VNDS', '9_5', '9', '8_5', '8'], {
    errorMap: () => ({ message: 'Invalid condition grade' }),
  }),
  size_us: z.string().min(1, 'Size required'),
  price_vnd: z.number().int().positive('Price must be positive'),
  color_way: z.string().optional().default(''),
  release_year: z.number().int().min(1980).max(new Date().getFullYear()),
  hub_id: z.string().min(1, 'Hub required'),
  seller_id: z.string().uuid('Invalid seller ID'),
});

export type SubmitPostInput = z.infer<typeof submitPostSchema>;

export interface SubmitPostResult {
  success: boolean;
  postId?: string;
  passportId?: string;
  error?: string;
}

/**
 * Helper: Generate lot code từ brand + model + random suffix
 * Format: A-123 (letter + 3 digits)
 */
function generateLotCode(): string {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
  const number = Math.floor(100 + Math.random() * 900); // 100-999
  return `${letter}-${number}`;
}

/**
 * Main action: Submit post
 * 1. Validate input
 * 2. Create post (status='pending_payment')
 * 3. Create shoe_passport
 * 4. Create ownership_history record
 * 5. Return postId + passportId
 */
export async function submitPost(
  input: SubmitPostInput
): Promise<SubmitPostResult> {
  try {
    // Validate
    const validated = submitPostSchema.parse(input);

    // Generate lot code
    const lotCode = generateLotCode();

    // Get settings: min/max price từ platform config
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

    if (validated.price_vnd < minPrice || validated.price_vnd > maxPrice) {
      throw new Error(
        `Price must be between ${minPrice} and ${maxPrice} VND`
      );
    }

    // 1. Create post
    const { data: postData, error: postError } = await supabase
      .from('posts')
      .insert([
        {
          lot_id: lotCode,
          seller_id: validated.seller_id,
          brand: validated.brand,
          model: validated.model,
          color_way: validated.color_way,
          condition: validated.condition,
          size_us: validated.size_us,
          release_year: validated.release_year,
          price_vnd: validated.price_vnd,
          hub_id: validated.hub_id,
          status: 'draft', // Start as draft, seller phải thanh toán để → pending_verify
          visibility: 'private', // Only seller sees until payment
        },
      ])
      .select()
      .single();

    if (postError) throw postError;
    if (!postData) throw new Error('Failed to create post');

    const postId = postData.id;

    // 2. Create shoe_passport
    const passportId = `16S-${lotCode}-${Math.random().toString(36).substring(2, 6)}`;

    const { data: passportData, error: passportError } = await supabase
      .from('shoe_passports')
      .insert([
        {
          id: passportId,
          post_id: postId,
          owner_id: validated.seller_id,
          is_lost: false,
          asset_metadata: {
            privacy_mode: 'public',
            auto_hide_night: false,
          },
        },
      ])
      .select()
      .single();

    if (passportError) throw passportError;
    if (!passportData) throw new Error('Failed to create passport');

    // 3. Create ownership_history record
    const { error: ownershipError } = await supabase
      .from('ownership_history')
      .insert([
        {
          passport_id: passportId,
          owner_id: validated.seller_id,
          owner_handle_snapshot: 'unknown', // Will update after user completes profile
          owner_display_name_snapshot: 'unknown',
          acquisition_type: 'initial',
          notes: 'Submitted by seller',
        },
      ]);

    if (ownershipError) throw ownershipError;

    console.log(
      `[submitPost] Created post ${postId}, passport ${passportId}, lot ${lotCode}`
    );

    return {
      success: true,
      postId,
      passportId,
    };
  } catch (err) {
    console.error('[submitPost] Full error:', err);
    console.error('[submitPost] Error type:', err instanceof Error ? 'Error' : typeof err);
    
    if (err instanceof z.ZodError) {
      const firstError = err.errors[0];
      console.error('[submitPost] Validation error:', {
        path: firstError.path.join('.'),
        message: firstError.message,
        code: firstError.code,
      });
      return {
        success: false,
        error: `Validation error at ${firstError.path.join('.')}: ${firstError.message}`,
      };
    }

    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
    };
  }
}

/**
 * Helper: Verify post (admin action)
 * post status: pending_verify → live
 */
export async function verifyPost(
  postId: string,
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('posts')
      .update({
        status: 'live',
        visibility: 'public',
      })
      .eq('id', postId)
      .eq('status', 'pending_verify');

    if (error) throw error;

    // Log verification event
    await supabase.from('notifications').insert([
      {
        user_id: (
          await supabase
            .from('posts')
            .select('seller_id')
            .eq('id', postId)
            .single()
        ).data?.seller_id,
        channel: 'in_app',
        event: 'post_verified',
        message: 'Your post has been verified and is now live',
        payload: { post_id: postId },
      },
    ]);

    console.log(`[verifyPost] Verified post ${postId}`);
    return { success: true };
  } catch (err) {
    console.error('[verifyPost] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Helper: Reject post (admin action)
 * post status: pending_verify → rejected
 */
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
      .eq('status', 'pending_verify');

    if (error) throw error;

    // Notify seller
    const { data: post } = await supabase
      .from('posts')
      .select('seller_id')
      .eq('id', postId)
      .single();

    if (post) {
      await supabase.from('notifications').insert([
        {
          user_id: post.seller_id,
          channel: 'in_app',
          event: 'post_rejected',
          message: `Your post was rejected: ${reason}`,
          payload: { post_id: postId, reason },
        },
      ]);
    }

    console.log(`[rejectPost] Rejected post ${postId}`);
    return { success: true };
  } catch (err) {
    console.error('[rejectPost] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
