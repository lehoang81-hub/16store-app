// src/app/api/social-card/generate/route.ts
// POST /api/social-card/generate
// Body: { passportId: UUID, style: 'editorial'|'street'|'archive', taglineLang: 'vi'|'en' }
// Return: { posterUrl, publicCode, tagline, cached: boolean, taglineSource: 'ai'|'fallback' }

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentUser } from '@/lib/queries/current-user';

import {
  SOCIAL_CARD_CONFIG,
  SOCIAL_CARD_STYLES,
  TAGLINE_LANGS,
} from '@/lib/social-card/config';
import {
  checkGlobalLimits,
  trackGeminiCall,
  estimateImageCost,
  estimateTextCost,
} from '@/lib/social-card/cost-control';
import { generateTagline } from '@/lib/social-card/gemini-tagline';
import { generateBackground } from '@/lib/social-card/gemini-background';
import { composePoster } from '@/lib/social-card/compose-poster';
import { uploadPoster } from '@/lib/social-card/upload-storage';

export const runtime = 'nodejs'; // Sharp cần Node runtime
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Gemini có thể mất 10-30s

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const GenerateSchema = z.object({
  passportId: z.string().uuid(),
  style: z.enum(SOCIAL_CARD_STYLES),
  taglineLang: z.enum(TAGLINE_LANGS).default('vi'),
});

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // ─── Step 1: Auth ───
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Vui lòng đăng nhập để tạo poster' },
        { status: 401 },
      );
    }

    // ─── Step 2: Parse & validate body ───
    const body = await req.json();
    const parsed = GenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Tham số không hợp lệ', details: parsed.error.issues },
        { status: 400 },
      );
    }
    const { passportId, style, taglineLang } = parsed.data;

    const supabase = createServiceClient();

    // ─── Step 3: Check global limits (daily cap + monthly budget + kill switch) ───
    const globalCheck = await checkGlobalLimits();
    if (!globalCheck.allowed) {
      return NextResponse.json(
        {
          error: globalCheck.message_vi ?? 'Hệ thống đang đạt giới hạn',
          errorCode: globalCheck.reason,
          resetAt: globalCheck.reset_at,
        },
        { status: 429 },
      );
    }

    // ─── Step 4: Fetch passport data ───
    const { data: passport, error: passportErr } = await supabase
      .from('shoe_passports')
      .select('id, qr_code, current_post_id, total_scans, total_owners, created_at')
      .eq('id', passportId)
      .single();

    if (passportErr || !passport) {
      return NextResponse.json(
        { error: 'Không tìm thấy passport' },
        { status: 404 },
      );
    }

    // ─── Step 5: Cache lookup ───
    // Nếu user đã tạo poster với cùng passport + style + lang trong 7 ngày → return cached
    const { data: cachedCard } = await supabase
      .from('social_cards')
      .select('id, public_code, poster_url, ai_tagline')
      .eq('passport_id', passportId)
      .eq('creator_user_id', user.id)
      .eq('style', style)
      .eq('tagline_lang', taglineLang)
      .gt('cache_expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cachedCard) {
      return NextResponse.json({
        posterUrl: cachedCard.poster_url,
        publicCode: cachedCard.public_code,
        tagline: cachedCard.ai_tagline,
        cached: true,
        taglineSource: 'ai',
      });
    }

    // ─── Step 6: Check per-user rate limit ───
    const { data: rateLimitResult, error: rateLimitErr } = await supabase.rpc(
      'check_social_card_rate_limit',
      {
        p_user_id: user.id,
        p_passport_id: passportId,
        p_limit: SOCIAL_CARD_CONFIG.RATE_LIMIT_PER_DAY,
        p_window_hours: SOCIAL_CARD_CONFIG.RATE_LIMIT_WINDOW_HOURS,
      },
    );

    if (rateLimitErr) {
      console.error('[social-card] rate limit check error:', rateLimitErr);
      return NextResponse.json(
        { error: 'Không kiểm tra được rate limit, vui lòng thử lại' },
        { status: 500 },
      );
    }

    const rateLimit = rateLimitResult as {
      allowed: boolean;
      remaining: number;
      reset_at: string | null;
    };

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Bạn đã tạo tối đa ${SOCIAL_CARD_CONFIG.RATE_LIMIT_PER_DAY} posters cho pair này hôm nay. Reset vào ${formatTime(rateLimit.reset_at)}.`,
          errorCode: 'user_rate_limit',
          resetAt: rateLimit.reset_at,
        },
        { status: 429 },
      );
    }

    // ─── Step 7: Fetch pair details + journey data ───
    const [postResult, scansResult] = await Promise.all([
      passport.current_post_id
        ? supabase
            .from('posts_with_seller')
            .select('brand, model, colorway, lot_id')
            .eq('id', passport.current_post_id)
            .single()
        : Promise.resolve({ data: null }),
      supabase
        .from('scan_events')
        .select('city')
        .eq('passport_id', passportId)
        .eq('is_meaningful', true),
    ]);

    const post = postResult.data;
    const scans = scansResult.data ?? [];

    const brand = post?.brand ?? 'Unknown';
    const model = post?.model ?? 'Pair';
    const colorway = post?.colorway ?? '';
    const lotId = post?.lot_id ?? '';

    const citiesList = [...new Set(scans.map((s) => s.city).filter(Boolean))];
    const cityCount = citiesList.length;
    const scanCount = passport.total_scans ?? scans.length;
    const ownerCount = passport.total_owners ?? 1;

    const daysOwned = Math.floor(
      (Date.now() - new Date(passport.created_at).getTime()) / (1000 * 60 * 60 * 24),
    );

    // ─── Step 8: Generate AI tagline ───
    let tagline = '';
    let taglineSource: 'ai' | 'fallback' = 'fallback';

    try {
      tagline = await trackGeminiCall(
        {
          userId: user.id,
          passportId,
          callType: 'text',
          modelName: SOCIAL_CARD_CONFIG.MODEL_TEXT,
        },
        async () => {
          const result = await generateTagline(taglineLang, {
            brand,
            model,
            colorway,
            cityCount,
            scanCount,
            ownerCount,
            daysOwned,
            citiesList: citiesList as string[],
          });
          taglineSource = 'ai';
          return result;
        },
        estimateTextCost(300, 50),
      );
    } catch (err) {
      console.warn('[social-card] tagline failed, using fallback:', err);
      tagline = taglineLang === 'vi'
        ? `Một đôi giày. Một ký ức đang được viết tiếp.`
        : `One pair. A memory still being written.`;
      taglineSource = 'fallback';
    }

    // ─── Step 9: Generate background (Gemini Image) ───
    let backgroundBuffer: Buffer | null = null;

    try {
      const bgResult = await trackGeminiCall(
        {
          userId: user.id,
          passportId,
          callType: 'image',
          modelName: SOCIAL_CARD_CONFIG.MODEL_IMAGE,
        },
        async () => generateBackground({ style, brand, model, colorway }),
        estimateImageCost(),
      );
      backgroundBuffer = bgResult.imageBuffer;
    } catch (err) {
      console.warn('[social-card] background gen failed, using fallback:', err);
    }

    // ─── Step 10: Build QR URL với affiliate ref ───
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const qrUrl = `${baseUrl}${SOCIAL_CARD_CONFIG.QR_BASE_PATH}/${passport.qr_code}?ref=${user.id}`;

    // ─── Step 11: Compose final poster ───
    const posterBuffer = await composePoster({
      backgroundBuffer,
      style,
      brand,
      model,
      colorway,
      tagline,
      cityCount,
      scanCount,
      ownerCount,
      lotId,
      qrCode: passport.qr_code,
      qrUrl,
    });

    // ─── Step 12: Create social_cards row ───
    const { data: newCard, error: insertErr } = await supabase
      .from('social_cards')
      .insert({
        passport_id: passportId,
        post_id: passport.current_post_id ?? null,
        creator_user_id: user.id,
        style,
        tagline_lang: taglineLang,
        ai_tagline: tagline,
        background_prompt: null,
        background_url: null,
        poster_url: 'pending',
        poster_width: SOCIAL_CARD_CONFIG.POSTER_WIDTH,
        poster_height: SOCIAL_CARD_CONFIG.POSTER_HEIGHT,
        affiliate_enabled: true,
        affiliate_code: user.id,
      })
      .select('id, public_code')
      .single();

    if (insertErr || !newCard) {
      console.error('[social-card] insert error:', insertErr);
      return NextResponse.json(
        { error: 'Không lưu được poster vào database' },
        { status: 500 },
      );
    }

    // ─── Step 13: Upload to Storage ───
    let publicUrl: string;
    try {
      const uploadResult = await uploadPoster(
        posterBuffer,
        passportId,
        newCard.public_code,
      );
      publicUrl = uploadResult.publicUrl;
    } catch (err) {
      console.error('[social-card] upload error:', err);
      await supabase.from('social_cards').delete().eq('id', newCard.id);
      return NextResponse.json(
        { error: 'Không upload được poster lên storage' },
        { status: 500 },
      );
    }

    // ─── Step 14: Update poster_url ───
    await supabase
      .from('social_cards')
      .update({ poster_url: publicUrl })
      .eq('id', newCard.id);

    // ─── Step 15: Response ───
    return NextResponse.json({
      posterUrl: publicUrl,
      publicCode: newCard.public_code,
      tagline,
      cached: false,
      taglineSource,
      remaining: rateLimit.remaining,
    });
  } catch (error) {
    console.error('[social-card] unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Lỗi hệ thống: ' + message.slice(0, 200) },
      { status: 500 },
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTime(iso: string | null): string {
  if (!iso) return 'ngày mai';
  try {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return 'ngày mai';
  }
}
