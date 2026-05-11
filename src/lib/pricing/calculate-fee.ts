import { createServiceClient } from '@/lib/supabase/service';

export interface FeeCalculation {
  fee_amount_vnd: number;
  fee_rate: number;
  applied_rule_id: string | null;
  campaign_name: string | null;
}

interface PricingRuleRow {
  id: string;
  conditions: Record<string, unknown>;
  fee_type: 'percent' | 'flat';
  fee_value: number;
  priority: number;
  campaign: { id: string; name: string; status: string; starts_at: string; ends_at: string } | null;
}

/**
 * Tính phí ký gửi cho 1 pair.
 * Schema mới: dùng users_view thay vì users
 * Fallback: 12% nếu không match rule nào
 */
export async function calculateListingFee(params: {
  brand: string;
  asking_price_vnd: number;
  user_id?: string | null;
}): Promise<FeeCalculation> {
  const supabase = createServiceClient();
  const { brand, asking_price_vnd, user_id } = params;

  // Lấy reputation (nếu có user_id)
  let userReputation = 0;
  if (user_id) {
    // Schema mới: dùng users_view
    const { data: user } = await supabase
      .from('users_view')
      .select('reputation_score')
      .eq('id', user_id)
      .single();
    userReputation = user?.reputation_score ?? 0;
  }

  // Lấy active pricing rules
  const nowIso = new Date().toISOString();
  const { data: rules } = await supabase
    .from('pricing_rules')
    .select('id, conditions, fee_type, fee_value, priority, campaign:campaigns!left(id, name, status, starts_at, ends_at)')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  const rulesList = (rules ?? []) as unknown as PricingRuleRow[];

  for (const rule of rulesList) {
    // Check campaign active
    if (rule.campaign) {
      const campaign = rule.campaign;
      if (campaign.status !== 'active') continue;
      if (nowIso < campaign.starts_at || nowIso > campaign.ends_at) continue;
    }

    // Check conditions
    const conds = rule.conditions as Record<string, unknown>;

    if (conds.brand !== undefined) {
      const brandArr = conds.brand as string[];
      if (!brandArr.includes(brand)) continue;
    }

    if (conds.min_price_vnd !== undefined) {
      const minPrice = Number(conds.min_price_vnd);
      if (asking_price_vnd < minPrice) continue;
    }

    if (conds.min_reputation !== undefined) {
      const minRep = Number(conds.min_reputation);
      if (userReputation < minRep) continue;
    }

    // Rule match
    if (rule.fee_type === 'percent') {
      return {
        fee_amount_vnd: Math.round(asking_price_vnd * rule.fee_value),
        fee_rate: rule.fee_value,
        applied_rule_id: rule.id,
        campaign_name: rule.campaign?.name ?? null,
      };
    } else {
      const feeFlat = Math.round(rule.fee_value);
      return {
        fee_amount_vnd: feeFlat,
        fee_rate: asking_price_vnd > 0 ? feeFlat / asking_price_vnd : 0,
        applied_rule_id: rule.id,
        campaign_name: rule.campaign?.name ?? null,
      };
    }
  }

  // Fallback: 12%
  return {
    fee_amount_vnd: Math.round(asking_price_vnd * 0.12),
    fee_rate: 0.12,
    applied_rule_id: null,
    campaign_name: null,
  };
}
