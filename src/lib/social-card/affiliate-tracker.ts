// src/lib/social-card/affiliate-tracker.ts
// Affiliate tracking logic — insert clicks, set/read cookies, hash PII.

import { createServiceClient } from '@/lib/supabase/service';
import { TABLES } from '@/lib/db/table-names';
import { SOCIAL_CARD_CONFIG } from './config';
import crypto from 'node:crypto';

export const AFFILIATE_COOKIE_NAME = 'affiliate_ref';

// ============================================================================
// COOKIE HELPERS
// ============================================================================

export function buildAffiliateCookie(referrerId: string): string {
  const maxAge = SOCIAL_CARD_CONFIG.COOKIE_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${AFFILIATE_COOKIE_NAME}=${encodeURIComponent(referrerId)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; HttpOnly${secure}`;
}

// ============================================================================
// PRIVACY HELPERS
// ============================================================================

export function hashIp(ip: string): string {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'fallback-salt';
  return crypto.createHash('sha256').update(ip + salt).digest('hex').slice(0, 16);
}

export function getClientIp(headers: Headers): string {
  const xForwarded = headers.get('x-forwarded-for');
  if (xForwarded) return xForwarded.split(',')[0].trim();
  const xReal = headers.get('x-real-ip');
  if (xReal) return xReal;
  return 'unknown';
}

// ============================================================================
// PLATFORM SETTINGS HELPER
// ============================================================================

/**
 * Đọc affiliate_commission_rate từ platform_settings DB.
 * Fallback về 300 bps (3%) nếu không tìm thấy.
 * Giá trị trong DB là % (vd: "3"), convert sang bps (* 100).
 */
async function getCommissionRateBps(): Promise<number> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'affiliate_commission_rate')
      .maybeSingle();

    if (data?.value) {
      const pct = parseFloat(data.value);
      if (!isNaN(pct) && pct >= 0 && pct <= 100) {
        return Math.round(pct * 100); // 3% → 300 bps
      }
    }
  } catch (err) {
    console.error('[affiliate] failed to read commission rate from DB:', err);
  }
  // Fallback
  return SOCIAL_CARD_CONFIG.COMMISSION_RATE_BPS;
}

// ============================================================================
// CLICK TRACKING
// ============================================================================

interface TrackClickParams {
  referrerUserId: string;
  qrCode: string;
  userAgent?: string;
  ipHash?: string;
  sessionId?: string;
}

export async function trackAffiliateClick(params: TrackClickParams): Promise<void> {
  try {
    const supabase = createServiceClient();

    const { data: passport } = await supabase
      .from(TABLES.SHOE_PASSPORTS)
      .select('id')
      .eq('qr_code', params.qrCode)
      .maybeSingle();

    if (!passport) {
      console.warn('[affiliate] passport not found for qr:', params.qrCode);
      return;
    }

    const { data: socialCard } = await supabase
      .from(TABLES.SOCIAL_CARDS)
      .select('id')
      .eq('passport_id', passport.id)
      .eq('creator_user_id', params.referrerUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: referrer } = await supabase
      .from(TABLES.USERS)
      .select('id')
      .eq('id', params.referrerUserId)
      .maybeSingle();

    if (!referrer) {
      console.warn('[affiliate] invalid referrer_user_id:', params.referrerUserId);
      return;
    }

    await supabase.from(TABLES.AFFILIATE_CLICKS).insert({
      referrer_user_id: params.referrerUserId,
      passport_id: passport.id,
      social_card_id: socialCard?.id ?? null,
      clicker_session_id: params.sessionId ?? null,
      clicker_ip_hash: params.ipHash ?? null,
      clicker_user_agent: params.userAgent?.slice(0, 500) ?? null,
      converted_to_purchase: false,
    });

    if (socialCard?.id) {
      await supabase.rpc('increment_social_card_stats', {
        p_card_id: socialCard.id,
        p_stat: 'scan',
      });
    }
  } catch (err) {
    console.error('[affiliate] trackClick error:', err);
  }
}

// ============================================================================
// CONVERSION CREDIT
// ============================================================================

interface CreditConversionParams {
  buyerUserId: string;
  postId: string;
  passportId: string;
  purchaseAmountVnd: number;
  affiliateRef: string | null;
}

export async function creditAffiliateConversion(
  params: CreditConversionParams,
): Promise<number | null> {
  if (!params.affiliateRef) return null;
  if (params.affiliateRef === params.buyerUserId) return null;

  try {
    const supabase = createServiceClient();

    const { data: referrer } = await supabase
      .from(TABLES.USERS)
      .select('id')
      .eq('id', params.affiliateRef)
      .maybeSingle();

    if (!referrer) return null;

    const { data: latestClick } = await supabase
      .from(TABLES.AFFILIATE_CLICKS)
      .select('id')
      .eq('referrer_user_id', params.affiliateRef)
      .eq('passport_id', params.passportId)
      .eq('converted_to_purchase', false)
      .order('clicked_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // ✅ Đọc commission rate từ DB thay vì hardcode
    const rateBps = await getCommissionRateBps();
    const commissionVnd = Math.floor((params.purchaseAmountVnd * rateBps) / 10000);

    const { data: credit, error } = await supabase
      .from(TABLES.AFFILIATE_CREDITS)
      .insert({
        referrer_user_id: params.affiliateRef,
        click_id: latestClick?.id ?? null,
        post_id: params.postId,
        passport_id: params.passportId,
        purchase_amount_vnd: params.purchaseAmountVnd,
        commission_rate_bps: rateBps,
        commission_amount_vnd: commissionVnd,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[affiliate] credit insert error:', error);
      return null;
    }

    if (latestClick?.id) {
      await supabase
        .from(TABLES.AFFILIATE_CLICKS)
        .update({
          converted_to_purchase: true,
          purchase_post_id: params.postId,
          purchase_amount_vnd: params.purchaseAmountVnd,
          converted_at: new Date().toISOString(),
        })
        .eq('id', latestClick.id);
    }

    return credit?.id ?? null;
  } catch (err) {
    console.error('[affiliate] creditConversion error:', err);
    return null;
  }
}
