// src/app/admin/social-card-stats/page.tsx
// Admin Dashboard — Social Card AI stats: cost, usage, top users, kill switch

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/queries/current-user';
import { createServiceClient } from '@/lib/supabase/service';
import { Nav } from '@/components/Nav';

export const dynamic = 'force-dynamic';

export default async function SocialCardStatsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/admin/social-card-stats');
  if (user.role !== 'super_admin') redirect('/');

  const supabase = createServiceClient();

  // ─── Today usage ───
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: todayUsage } = await supabase
    .from('social_card_usage_tracking')
    .select('id, call_type, status, cost_millicents, duration_ms, model_name, created_at, user_id')
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false });

  const { data: monthUsage } = await supabase
    .from('social_card_usage_tracking')
    .select('id, call_type, status, cost_millicents, duration_ms, created_at')
    .gte('created_at', monthStart.toISOString());

  // ─── All-time social cards ───
  const { data: allCards, count: totalCards } = await supabase
    .from('social_cards')
    .select('id, style, creator_user_id, scan_count, share_count, cached: cache_expires_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(100);

  // ─── Affiliate stats ───
  const { count: totalClicks } = await supabase
    .from('affiliate_clicks')
    .select('*', { count: 'exact', head: true });

  const { count: totalConversions } = await supabase
    .from('affiliate_clicks')
    .select('*', { count: 'exact', head: true })
    .eq('converted_to_purchase', true);

  const { data: pendingCredits } = await supabase
    .from('affiliate_credits')
    .select('commission_amount_vnd')
    .eq('status', 'pending');

  // ─── Compute stats ───
  const todaySuccess = todayUsage?.filter(u => u.status === 'success' && u.call_type === 'image') ?? [];
  const todayFailed = todayUsage?.filter(u => u.status === 'failed') ?? [];
  const todayRateLimited = todayUsage?.filter(u => u.status === 'rate_limited') ?? [];

  const todayCostMillicents = todayUsage
    ?.filter(u => u.status === 'success')
    .reduce((sum, u) => sum + (u.cost_millicents ?? 0), 0) ?? 0;

  const monthCostMillicents = monthUsage
    ?.filter(u => u.status === 'success')
    .reduce((sum, u) => sum + (u.cost_millicents ?? 0), 0) ?? 0;

  const avgDurationMs = todaySuccess.length > 0
    ? Math.round(todaySuccess.reduce((sum, u) => sum + (u.duration_ms ?? 0), 0) / todaySuccess.length)
    : 0;

  const pendingCommissionTotal = pendingCredits
    ?.reduce((sum, c) => sum + c.commission_amount_vnd, 0) ?? 0;

  // ─── Top users by poster count ───
  const userCounts: Record<string, number> = {};
  allCards?.forEach(card => {
    const uid = card.creator_user_id as string;
    userCounts[uid] = (userCounts[uid] ?? 0) + 1;
  });
  const topUsers = Object.entries(userCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // ─── Style distribution ───
  const styleCounts: Record<string, number> = {};
  allCards?.forEach(card => {
    const s = card.style as string;
    styleCounts[s] = (styleCounts[s] ?? 0) + 1;
  });

  // ─── Config from env ───
  const dailyCap = parseInt(process.env.SOCIAL_CARD_DAILY_CAP ?? '400');
  const budgetMillicents = parseInt(process.env.SOCIAL_CARD_BUDGET_MILLICENTS ?? '500000');
  const isEnabled = process.env.SOCIAL_CARD_ENABLED !== 'false';

  return (
    <>
      <Nav />
      <main className="max-w-[1200px] mx-auto px-8 py-10 max-md:px-5">

        {/* Header */}
        <div className="mb-10 pb-6 border-b border-line">
          <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Super Admin · Social Card AI
          </div>
          <div className="flex items-start justify-between gap-4 max-md:flex-col">
            <h1 className="font-display text-[clamp(36px,5vw,56px)] uppercase leading-[0.95]">
              Social Card<br />
              <span className="font-serif italic text-rust normal-case">Stats & Controls</span>
            </h1>
            {/* Kill switch status */}
            <div className={`border px-5 py-3 ${isEnabled ? 'border-[#6ec070] bg-[#6ec070]/5' : 'border-hazard bg-hazard/5'}`}>
              <div className={`font-mono text-[10px] tracking-[0.18em] uppercase mb-1 ${isEnabled ? 'text-[#6ec070]' : 'text-hazard'}`}>
                {isEnabled ? '● FEATURE BẬT' : '● FEATURE TẮT'}
              </div>
              <div className="font-mono text-[9px] text-concrete tracking-[0.12em]">
                SOCIAL_CARD_ENABLED={isEnabled ? 'true' : 'false'}
              </div>
            </div>
          </div>
        </div>

        {/* Today stats */}
        <section className="mb-10">
          <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase mb-4 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Hôm Nay
          </div>
          <div className="grid grid-cols-4 gap-0 border border-line max-md:grid-cols-2">
            <StatBox
              label="Posters generated"
              value={todaySuccess.length}
              sub={`/ ${dailyCap} limit`}
              highlight={todaySuccess.length >= dailyCap * 0.8}
            />
            <StatBox
              label="Chi phí ước tính"
              value={`$${(todayCostMillicents / 100000).toFixed(4)}`}
              sub={`/ $${(budgetMillicents / 100000).toFixed(2)} budget`}
              isText
              highlight={todayCostMillicents >= budgetMillicents * 0.8}
            />
            <StatBox
              label="Thất bại"
              value={todayFailed.length}
              sub={todayRateLimited.length > 0 ? `+ ${todayRateLimited.length} rate limited` : ''}
              isText={false}
              warn={todayFailed.length > 5}
            />
            <StatBox
              label="Avg duration"
              value={avgDurationMs > 0 ? `${(avgDurationMs / 1000).toFixed(1)}s` : '—'}
              isText
            />
          </div>

          {/* Usage bar */}
          <div className="mt-4 border border-line p-4">
            <div className="flex justify-between font-mono text-[10px] text-concrete tracking-[0.14em] uppercase mb-2">
              <span>Daily cap usage</span>
              <span>{todaySuccess.length} / {dailyCap}</span>
            </div>
            <div className="h-2 bg-ink-2 border border-line overflow-hidden">
              <div
                className="h-full bg-rust transition-all"
                style={{ width: `${Math.min((todaySuccess.length / dailyCap) * 100, 100)}%` }}
              />
            </div>
            {todaySuccess.length >= dailyCap * 0.8 && (
              <div className="mt-2 font-mono text-[10px] text-hazard tracking-[0.14em]">
                ⚠ Sắp đạt giới hạn — cân nhắc tăng daily cap hoặc xem user abuse
              </div>
            )}
          </div>
        </section>

        {/* Month stats */}
        <section className="mb-10">
          <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase mb-4 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Tháng Này
          </div>
          <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
            <InfoCard
              label="Tổng API calls thành công"
              value={`${monthUsage?.filter(u => u.status === 'success').length ?? 0}`}
            />
            <InfoCard
              label="Chi phí ước tính tháng"
              value={`$${(monthCostMillicents / 100000).toFixed(4)}`}
              sub={`Budget: $${(budgetMillicents / 100000).toFixed(2)}`}
            />
            <InfoCard
              label="Tổng posters all-time"
              value={`${totalCards ?? 0}`}
            />
          </div>
        </section>

        {/* Style distribution */}
        <section className="mb-10">
          <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase mb-4 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Phân Bố Style
          </div>
          <div className="grid grid-cols-3 gap-0 border border-line max-md:grid-cols-1">
            {['editorial', 'street', 'archive'].map(style => {
              const count = styleCounts[style] ?? 0;
              const total = totalCards ?? 1;
              const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
              return (
                <div key={style} className="p-5 border-r border-line last:border-r-0 max-md:border-r-0 max-md:border-b last:border-b-0">
                  <div className="font-mono text-[10px] text-concrete tracking-[0.18em] uppercase mb-2">{style}</div>
                  <div className="font-display text-3xl text-bone mb-1">{count}</div>
                  <div className="font-mono text-[10px] text-rust">{pct}%</div>
                  <div className="mt-2 h-1 bg-ink-2">
                    <div className="h-full bg-rust" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Affiliate stats */}
        <section className="mb-10">
          <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase mb-4 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Affiliate Tracking
          </div>
          <div className="grid grid-cols-3 gap-0 border border-line max-md:grid-cols-1">
            <div className="p-5 border-r border-line max-md:border-r-0 max-md:border-b">
              <div className="font-mono text-[10px] text-bone-2 tracking-[0.18em] uppercase mb-2">Tổng clicks</div>
              <div className="font-display text-4xl text-bone">{totalClicks ?? 0}</div>
            </div>
            <div className="p-5 border-r border-line max-md:border-r-0 max-md:border-b">
              <div className="font-mono text-[10px] text-bone-2 tracking-[0.18em] uppercase mb-2">Đã convert</div>
              <div className="font-display text-4xl text-rust">{totalConversions ?? 0}</div>
              <div className="font-mono text-[10px] text-concrete mt-1">
                {totalClicks && totalClicks > 0
                  ? `${(((totalConversions ?? 0) / totalClicks) * 100).toFixed(1)}% rate`
                  : '—'}
              </div>
            </div>
            <div className="p-5">
              <div className="font-mono text-[10px] text-bone-2 tracking-[0.18em] uppercase mb-2">Commission pending</div>
              <div className="font-display text-2xl text-hazard">
                {pendingCommissionTotal > 0
                  ? `${(pendingCommissionTotal / 1000000).toFixed(1)}M ₫`
                  : '0₫'}
              </div>
              <div className="font-mono text-[10px] text-concrete mt-1">Chờ admin xác nhận</div>
            </div>
          </div>
        </section>

        {/* Recent API calls log */}
        <section className="mb-10">
          <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase mb-4 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            API Calls Gần Đây · {todayUsage?.length ?? 0} hôm nay
          </div>

          {todayUsage && todayUsage.length > 0 ? (
            <div className="border border-line overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line">
                    {['Thời gian', 'Type', 'Model', 'Status', 'Duration', 'Cost'].map(h => (
                      <th key={h} className="p-3 text-left font-mono text-[9px] tracking-[0.16em] uppercase text-concrete">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todayUsage.slice(0, 15).map((call) => (
                    <tr key={call.id} className="border-b border-line last:border-b-0 hover:bg-ink-2/30">
                      <td className="p-3 font-mono text-[10px] text-bone-2">
                        {new Date(call.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="p-3 font-mono text-[10px] text-bone uppercase">{call.call_type}</td>
                      <td className="p-3 font-mono text-[10px] text-concrete">
                        {(call.model_name as string)?.replace('gemini-', 'g-') ?? '—'}
                      </td>
                      <td className="p-3">
                        <span className={`font-mono text-[10px] uppercase ${
                          call.status === 'success' ? 'text-[#6ec070]' :
                          call.status === 'rate_limited' ? 'text-hazard' : 'text-rust'
                        }`}>
                          {call.status as string}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[10px] text-bone-2">
                        {call.duration_ms ? `${((call.duration_ms as number) / 1000).toFixed(1)}s` : '—'}
                      </td>
                      <td className="p-3 font-mono text-[10px] text-bone-2">
                        {call.cost_millicents
                          ? `$${((call.cost_millicents as number) / 100000).toFixed(4)}`
                          : '$0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {todayUsage.length > 15 && (
                <div className="p-3 border-t border-line font-mono text-[10px] text-concrete text-center">
                  + {todayUsage.length - 15} calls khác hôm nay
                </div>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-line p-8 text-center">
              <div className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase">
                Chưa có API call nào hôm nay
              </div>
            </div>
          )}
        </section>

        {/* Config reference */}
        <section className="border border-line p-6 bg-ink-2/30">
          <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-4">
            Cấu hình hiện tại (.env.local)
          </div>
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            {[
              { key: 'SOCIAL_CARD_ENABLED', value: isEnabled ? 'true' : 'false' },
              { key: 'SOCIAL_CARD_DAILY_CAP', value: String(dailyCap) },
              { key: 'SOCIAL_CARD_BUDGET_MILLICENTS', value: `${budgetMillicents} ($${(budgetMillicents / 100000).toFixed(2)})` },
              { key: 'Affiliate commission', value: '300 bps (3%)' },
            ].map(({ key, value }) => (
              <div key={key} className="flex gap-3">
                <div className="font-mono text-[10px] text-bone-2 tracking-[0.12em] min-w-[240px]">{key}</div>
                <div className="font-mono text-[10px] text-rust">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-line font-mono text-[10px] text-concrete tracking-[0.12em]">
            Để thay đổi: sửa .env.local → restart server. Kill switch: đổi SOCIAL_CARD_ENABLED=false → restart.
          </div>
        </section>

      </main>
    </>
  );
}

// ─── Sub-components ───

function StatBox({ label, value, sub, highlight = false, warn = false, isText = false }: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
  warn?: boolean;
  isText?: boolean;
}) {
  return (
    <div className={`p-5 border-r border-line last:border-r-0 max-md:border-b max-md:last:border-b-0 ${
      warn ? 'bg-rust/5' : highlight ? 'bg-hazard/5' : ''
    }`}>
      <div className="font-mono text-[10px] text-bone-2 tracking-[0.16em] uppercase mb-2">{label}</div>
      <div className={`font-display ${isText ? 'text-2xl' : 'text-4xl'} ${
        warn ? 'text-rust' : highlight ? 'text-hazard' : 'text-bone'
      }`}>
        {value}
      </div>
      {sub && <div className="font-mono text-[9px] text-concrete mt-1 tracking-[0.1em]">{sub}</div>}
    </div>
  );
}

function InfoCard({ label, value, sub }: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border border-line p-5">
      <div className="font-mono text-[10px] text-bone-2 tracking-[0.16em] uppercase mb-2">{label}</div>
      <div className="font-display text-3xl text-bone">{value}</div>
      {sub && <div className="font-mono text-[9px] text-concrete mt-1 tracking-[0.1em]">{sub}</div>}
    </div>
  );
}
