// src/app/dashboard/affiliate/page.tsx
// Affiliate Dashboard — User xem clicks + commission từ poster đã share

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/queries/current-user';
import { createServiceClient } from '@/lib/supabase/service';
import { Nav } from '@/components/Nav';
import { formatVnd } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AffiliateDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/dashboard/affiliate');

  const supabase = createServiceClient();

  // ─── Stats tổng ───
  const { data: clickStats } = await supabase
    .from('affiliate_clicks')
    .select('id, converted_to_purchase, purchase_amount_vnd, clicked_at')
    .eq('referrer_user_id', user.id);

  const { data: credits } = await supabase
    .from('affiliate_credits')
    .select('id, commission_amount_vnd, purchase_amount_vnd, status, created_at, post_id')
    .eq('referrer_user_id', user.id)
    .order('created_at', { ascending: false });

  // ─── Social cards của user ───
  const { data: cards } = await supabase
    .from('social_cards')
    .select('id, public_code, style, ai_tagline, scan_count, share_count, view_count, poster_url, cache_expires_at, created_at, passport_id')
    .eq('creator_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  // ─── Compute stats ───
  const totalClicks = clickStats?.length ?? 0;
  const totalConversions = clickStats?.filter(c => c.converted_to_purchase).length ?? 0;
  const conversionRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : '0';

  const pendingCommission = credits
    ?.filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + c.commission_amount_vnd, 0) ?? 0;

  const confirmedCommission = credits
    ?.filter(c => c.status === 'confirmed')
    .reduce((sum, c) => sum + c.commission_amount_vnd, 0) ?? 0;

  const paidCommission = credits
    ?.filter(c => c.status === 'paid_out')
    .reduce((sum, c) => sum + c.commission_amount_vnd, 0) ?? 0;

  const totalEarned = pendingCommission + confirmedCommission + paidCommission;

  return (
    <>
      <Nav />
      <main className="max-w-[1100px] mx-auto px-8 py-10 max-md:px-5">

        {/* Header */}
        <div className="mb-10 pb-6 border-b border-line">
          <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Dashboard · Affiliate
          </div>
          <h1 className="font-display text-[clamp(36px,5vw,60px)] uppercase leading-[0.95]">
            Thu nhập<br />
            <span className="font-serif italic text-rust normal-case">từ chia sẻ</span>
          </h1>
          <p className="font-body text-sm text-bone-2 mt-3 max-w-[520px]">
            Mỗi khi ai quét QR trên poster bạn tạo và mua pair — bạn nhận 3% commission.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-0 border border-line mb-10 max-md:grid-cols-2">
          <StatBox label="Tổng clicks" value={totalClicks} />
          <StatBox label="Đã mua" value={totalConversions} highlight />
          <StatBox label="Tỷ lệ chuyển đổi" value={`${conversionRate}%`} isText />
          <StatBox label="Tổng đã kiếm" value={totalEarned > 0 ? formatVnd(totalEarned) : '0'} isText suffix="₫" />
        </div>

        {/* Commission breakdown */}
        {totalEarned > 0 ? (
          <section className="mb-10">
            <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase mb-4 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
              Commission Chi Tiết
            </div>
            <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
              <CommissionCard
                label="Đang chờ xác nhận"
                amount={pendingCommission}
                color="text-hazard"
                desc="Sau khi admin xác nhận thanh toán"
              />
              <CommissionCard
                label="Đã xác nhận"
                amount={confirmedCommission}
                color="text-bone"
                desc="Sẵn sàng để rút"
              />
              <CommissionCard
                label="Đã thanh toán"
                amount={paidCommission}
                color="text-[#6ec070]"
                desc="Đã chuyển khoản cho bạn"
              />
            </div>

            {/* Credits table */}
            {credits && credits.length > 0 && (
              <div className="mt-6 border border-line">
                <div className="p-4 border-b border-line font-mono text-[10px] tracking-[0.18em] uppercase text-concrete">
                  Lịch sử commission
                </div>
                {credits.map((credit) => (
                  <div key={credit.id} className="p-4 border-b border-line last:border-b-0 flex items-center justify-between gap-4 max-md:flex-col max-md:items-start">
                    <div>
                      <div className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase mb-1">
                        {new Date(credit.created_at).toLocaleDateString('vi-VN')}
                      </div>
                      <div className="font-body text-sm text-bone-2">
                        Mua hàng {formatVnd(credit.purchase_amount_vnd)}₫
                      </div>
                    </div>
                    <div className="text-right max-md:text-left">
                      <div className={`font-display text-lg ${
                        credit.status === 'paid_out' ? 'text-[#6ec070]' :
                        credit.status === 'confirmed' ? 'text-bone' : 'text-hazard'
                      }`}>
                        +{formatVnd(credit.commission_amount_vnd)}₫
                      </div>
                      <div className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase">
                        {credit.status === 'paid_out' ? 'Đã trả' :
                         credit.status === 'confirmed' ? 'Xác nhận' : 'Chờ xử lý'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="mb-10 border border-dashed border-line p-8 text-center">
            <div className="font-display text-3xl text-concrete mb-3">💰</div>
            <div className="font-display text-xl uppercase mb-2">Chưa có commission nào</div>
            <p className="font-body text-sm text-bone-2 max-w-[420px] mx-auto">
              Tạo poster AI cho pair, share lên mạng xã hội. Khi ai quét QR và mua — bạn nhận 3%.
            </p>
          </section>
        )}

        {/* Posters của user */}
        <section className="mb-10">
          <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase mb-4 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Posters Đã Tạo · {cards?.length ?? 0} posters
          </div>

          {cards && cards.length > 0 ? (
            <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
              {cards.map((card) => (
                <div key={card.id} className="border border-line hover:border-rust transition-colors">
                  {/* Poster thumbnail */}
                  <div className="aspect-[4/5] overflow-hidden bg-ink-2">
                    <img
                      src={card.poster_url}
                      alt={`Poster ${card.public_code}`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Card info */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-mono text-[10px] text-rust tracking-[0.14em] uppercase">
                        {card.style}
                      </div>
                      <div className="font-mono text-[9px] text-concrete tracking-[0.12em]">
                        {card.public_code}
                      </div>
                    </div>

                    {card.ai_tagline && (
                      <p className="font-serif italic text-xs text-bone-2 mb-3 line-clamp-2">
                        "{card.ai_tagline}"
                      </p>
                    )}

                    {/* Stats mini */}
                    <div className="flex gap-4 font-mono text-[10px] text-concrete">
                      <span>👁 {card.view_count}</span>
                      <span>📱 {card.scan_count} scans</span>
                      <span>↗ {card.share_count} shares</span>
                    </div>

                    {/* Cache status */}
                    <div className="mt-3 pt-3 border-t border-line">
                      {new Date(card.cache_expires_at) > new Date() ? (
                        <div className="font-mono text-[9px] text-[#6ec070] tracking-[0.12em]">
                          ⚡ Cache còn đến {new Date(card.cache_expires_at).toLocaleDateString('vi-VN')}
                        </div>
                      ) : (
                        <div className="font-mono text-[9px] text-concrete tracking-[0.12em]">
                          Cache hết hạn · Tạo mới để refresh
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-line p-8 text-center">
              <div className="font-display text-3xl text-concrete mb-3">🎨</div>
              <div className="font-display text-xl uppercase mb-2">Chưa có poster nào</div>
              <p className="font-body text-sm text-bone-2 mb-4">
                Tạo poster AI từ trang passport hoặc lot detail của bất kỳ pair nào.
              </p>
              <Link
                href="/"
                className="font-mono text-[11px] text-rust tracking-[0.2em] uppercase hover:text-bone transition-colors"
              >
                Khám phá pairs →
              </Link>
            </div>
          )}
        </section>

        {/* How it works */}
        <section className="border border-line p-6 bg-ink-2/30">
          <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-4">
            Cách hoạt động
          </div>
          <div className="grid grid-cols-3 gap-6 max-md:grid-cols-1">
            {[
              { step: '01', title: 'Tạo poster AI', desc: 'Vào trang passport của pair → Tạo poster với style bạn thích.' },
              { step: '02', title: 'Chia sẻ', desc: 'Download poster hoặc share trực tiếp lên Facebook, Zalo, Telegram.' },
              { step: '03', title: 'Nhận commission', desc: 'Ai scan QR trên poster rồi mua pair đó → bạn nhận 3% giá trị giao dịch.' },
            ].map(({ step, title, desc }) => (
              <div key={step}>
                <div className="font-mono text-3xl text-rust/30 mb-2">{step}</div>
                <div className="font-display text-base uppercase mb-2">{title}</div>
                <p className="font-body text-sm text-bone-2">{desc}</p>
              </div>
            ))}
          </div>
        </section>

      </main>
    </>
  );
}

// ─── Sub-components ───

function StatBox({ label, value, highlight = false, isText = false, suffix = '' }: {
  label: string;
  value: number | string;
  highlight?: boolean;
  isText?: boolean;
  suffix?: string;
}) {
  return (
    <div className={`p-6 border-r border-line last:border-r-0 max-md:border-b max-md:last:border-b-0 ${highlight ? 'bg-rust/5' : ''}`}>
      <div className="font-mono text-[10px] text-bone-2 tracking-[0.18em] uppercase mb-2">{label}</div>
      <div className={`font-display ${isText ? 'text-2xl' : 'text-4xl'} ${highlight ? 'text-rust' : 'text-bone'}`}>
        {value}{suffix}
      </div>
    </div>
  );
}

function CommissionCard({ label, amount, color, desc }: {
  label: string;
  amount: number;
  color: string;
  desc: string;
}) {
  return (
    <div className="border border-line p-5">
      <div className="font-mono text-[10px] text-bone-2 tracking-[0.14em] uppercase mb-3">{label}</div>
      <div className={`font-display text-3xl ${color} mb-2`}>
        {formatVnd(amount)}₫
      </div>
      <div className="font-body text-xs text-concrete">{desc}</div>
    </div>
  );
}
