// src/lib/social-card/cost-control.ts
// Cost control layer — check global limits + log usage cho mỗi Gemini call

import { createServiceClient } from '@/lib/supabase/service';

// ============================================================================
// CONFIG (có thể move sang env variables hoặc platform_settings sau)
// ============================================================================

export const COST_CONFIG = {
  // Daily cap toàn platform (posters/ngày)
  DAILY_CAP: parseInt(process.env.SOCIAL_CARD_DAILY_CAP ?? '400', 10),

  // Monthly budget tính bằng millicents ($5 = 500000 millicents)
  // 1 cent = 1000 millicents. Dùng millicents để tránh floating point errors.
  MONTHLY_BUDGET_MILLICENTS: parseInt(
    process.env.SOCIAL_CARD_BUDGET_MILLICENTS ?? '500000',
    10,
  ),

  // Cost constants (đúng theo Gemini API public pricing 2026)
  COST_IMAGE_MILLICENTS: 3900, // $0.039 = 3900 millicents per image
  COST_TEXT_INPUT_PER_MILLION_MILLICENTS: 30, // $0.00003 per token input = 30 millicents per 1M tokens (approx for Flash)
  COST_TEXT_OUTPUT_PER_MILLION_MILLICENTS: 250,

  // Kill switch — có thể override qua env
  ENABLED: process.env.SOCIAL_CARD_ENABLED !== 'false', // default true
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface GlobalLimitsCheck {
  allowed: boolean;
  reason?: 'daily_cap_exceeded' | 'monthly_budget_exceeded';
  today_count: number;
  daily_cap: number;
  today_remaining?: number;
  month_spent_millicents: number;
  monthly_budget_millicents: number;
  month_remaining_millicents?: number;
  reset_at?: string;
  message_vi?: string;
  message_en?: string;
}

export type CallType = 'image' | 'text' | 'combined';
export type CallStatus = 'pending' | 'success' | 'failed' | 'rate_limited';

// ============================================================================
// CHECK GLOBAL LIMITS
// ============================================================================

/**
 * Call TRƯỚC khi gọi Gemini API.
 * Check daily cap + monthly budget.
 * Return allowed=false kèm message lỗi nếu vượt.
 */
export async function checkGlobalLimits(): Promise<GlobalLimitsCheck> {
  // Kill switch toàn cục (env variable)
  if (!COST_CONFIG.ENABLED) {
    return {
      allowed: false,
      reason: 'monthly_budget_exceeded', // Reuse reason, admin đã tắt manual
      today_count: 0,
      daily_cap: COST_CONFIG.DAILY_CAP,
      month_spent_millicents: 0,
      monthly_budget_millicents: COST_CONFIG.MONTHLY_BUDGET_MILLICENTS,
      message_vi: 'Tính năng tạo poster AI tạm khóa. Vui lòng liên hệ admin.',
      message_en: 'AI poster generation is temporarily disabled.',
    };
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('check_social_card_global_limits', {
    p_daily_cap: COST_CONFIG.DAILY_CAP,
    p_monthly_budget_millicents: COST_CONFIG.MONTHLY_BUDGET_MILLICENTS,
  });

  if (error) {
    console.error('[cost-control] check_global_limits RPC error:', error);
    // Fail-safe: nếu check fail thì block (tránh tốn tiền nếu DB lỗi)
    return {
      allowed: false,
      today_count: 0,
      daily_cap: COST_CONFIG.DAILY_CAP,
      month_spent_millicents: 0,
      monthly_budget_millicents: COST_CONFIG.MONTHLY_BUDGET_MILLICENTS,
      message_vi: 'Không kiểm tra được giới hạn sử dụng. Vui lòng thử lại sau.',
      message_en: 'Unable to check usage limits. Please try again later.',
    };
  }

  return data as GlobalLimitsCheck;
}

// ============================================================================
// LOG USAGE
// ============================================================================

interface LogUsageParams {
  userId: string;
  passportId: string;
  socialCardId?: string | null;
  callType: CallType;
  modelName: string;
  status: CallStatus;
  costMillicents?: number;
  durationMs?: number;
  errorMessage?: string;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Log 1 Gemini API call vào tracking table.
 * Call SAU khi Gemini trả về (thành công hoặc thất bại).
 */
export async function logUsage(params: LogUsageParams): Promise<number | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('log_social_card_usage', {
    p_user_id: params.userId,
    p_passport_id: params.passportId,
    p_social_card_id: params.socialCardId ?? null,
    p_call_type: params.callType,
    p_model_name: params.modelName,
    p_status: params.status,
    p_cost_millicents: params.costMillicents ?? 0,
    p_duration_ms: params.durationMs ?? null,
    p_error_message: params.errorMessage ?? null,
    p_input_tokens: params.inputTokens ?? null,
    p_output_tokens: params.outputTokens ?? null,
  });

  if (error) {
    console.error('[cost-control] log_usage RPC error:', error);
    return null;
  }

  return typeof data === 'number' ? data : null;
}

// ============================================================================
// COST ESTIMATION
// ============================================================================

/**
 * Ước tính cost cho 1 image call (Gemini 2.5 Flash Image).
 * Return millicents.
 */
export function estimateImageCost(): number {
  return COST_CONFIG.COST_IMAGE_MILLICENTS;
}

/**
 * Ước tính cost cho 1 text call dựa trên tokens.
 * Return millicents.
 */
export function estimateTextCost(inputTokens: number, outputTokens: number): number {
  const inputCost =
    (inputTokens * COST_CONFIG.COST_TEXT_INPUT_PER_MILLION_MILLICENTS) / 1_000_000;
  const outputCost =
    (outputTokens * COST_CONFIG.COST_TEXT_OUTPUT_PER_MILLION_MILLICENTS) / 1_000_000;
  return Math.ceil(inputCost + outputCost);
}

// ============================================================================
// WRAP GEMINI CALL WITH TRACKING
// ============================================================================

interface TrackingContext {
  userId: string;
  passportId: string;
  socialCardId?: string | null;
  callType: CallType;
  modelName: string;
}

/**
 * Wrap 1 Gemini call với full tracking logic:
 * - Log pending TRƯỚC khi call
 * - Measure duration
 * - Log success/failed SAU khi call
 * - Estimate cost và ghi vào tracking
 *
 * Dùng như sau:
 *   const result = await trackGeminiCall(context, async () => {
 *     return await geminiClient.generateImage(...);
 *   });
 */
export async function trackGeminiCall<T>(
  context: TrackingContext,
  fn: () => Promise<T>,
  estimatedCostMillicents: number,
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    // Log success
    await logUsage({
      ...context,
      status: 'success',
      costMillicents: estimatedCostMillicents,
      durationMs: duration,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Detect rate limit vs generic failure
    const isRateLimit =
      errorMsg.toLowerCase().includes('rate') ||
      errorMsg.toLowerCase().includes('429') ||
      errorMsg.toLowerCase().includes('quota');

    await logUsage({
      ...context,
      status: isRateLimit ? 'rate_limited' : 'failed',
      costMillicents: 0, // Không tính cost cho failed calls
      durationMs: duration,
      errorMessage: errorMsg.slice(0, 500),
    });

    // Re-throw để caller xử lý
    throw error;
  }
}
