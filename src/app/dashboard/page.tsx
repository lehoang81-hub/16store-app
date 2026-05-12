import { getCurrentUser } from '@/lib/queries/current-user';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/Nav';
import { SneakerThumb } from '@/components/SneakerThumb';
import { formatVnd, formatSize, timeAgo, conditionLabel } from '@/lib/utils';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { PostStatus } from '@/types/database';

const STATUS_LABELS: Record<PostStatus, { label: string; color: string }> = {
  draft:          { label: 'Nháp',          color: 'text-concrete' },
  pending_verify: { label: '⏳ Chờ verify', color: 'text-hazard' },
  live:           { label: '● Đang live',   color: 'text-rust' },
  reserved:       { label: '⊠ Đặt cọc',    color: 'text-bone-2' },
  sold:           { label: '✓ Đã bán',      color: 'text-[#6ec070]' },
  rejected:       { label: '✕ Bị từ chối', color: 'text-rust' },
  withdrawn:      { label: '↩ Đã rút',     color: 'text-concrete' },
pending_payment: { label: '💳 Chờ thanh toán', color: 'text-hazard' },
};

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  standard: { label: 'STD',        color: 'text-concrete' },
  elite:    { label: '◆ ELITE',    color: 'text-[#d4af37]' },
  heritage: { label: '⬡ HERITAGE', color: 'text-[#b8eaff]' },
};

const IDENTITY_STATUS: Record<string, { label: string; color: string }> = {
  unverified:   { label: '○ Chưa định danh', color: 'text-concrete' },
  temp_claimed: { label: '◉ Đã định danh',   color: 'text-rust' },
  certified:    { label: '✦ Chứng nhận',     color: 'text-[#d4af37]' },
};

const OBJECT_ICON: Record<string, string> = {
  sneaker:  '👟',
  watch:    '⌚',
  bag:      '👜',
  art:      '🎨',
  ceramics: '🏺',
  generic:  '📦',
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/dashboard');

  const params = await searchParams;
  const supabase = await createClient();

  // Posts (ký gửi bán)
  const { data: posts } = await supabase
    .from('posts_with_seller')
    .select('*')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  const myPosts    = posts ?? [];
  const liveCount  = myPosts.filter((p) => p.status === 'live').length;
  const draftCount = myPosts.filter((p) => ['draft','pending_verify'].includes(p.status)).length;
  const soldCount  = myPosts.filter((p) => p.status === 'sold').length;

  // Universal assets định danh độc lập (post_id = null)
  const { data: identifiedAssets } = await supabase
    .from('universal_assets')
    .select('id, qr_code, brand, model, colorway, object_type, identity_status, security_tier, claim_window_expires_at, first_claimant_id, created_at')
    .eq('owner_id', user.id)
    .is('post_id', null)
    .order('created_at', { ascending: false });

  const myAssets   = identifiedAssets ?? [];
  const totalItems = myPosts.length + myAssets.length;

  return (
    <>
      <Nav />
      <main className="px-8 py-12 max-w-[1200px] mx-auto max-md:px-5 max-md:py-8">

        {params.submitted && (
          <div className="border border-rust bg-rust/5 p-5 mb-8 flex items-start gap-4">
            <div className="font-display text-3xl text-rust">✓</div>
            <div>
              <div className="font-display text-base uppercase mb-1"> ✓ Đã đăng bán · LOT{params.submitted}</div>
              <div className="text-sm text-bone-2 leading-[1.5]">
                Vật phẩm đang chờ verify. Mang đến hub trong vòng 7 ngày.
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-end mb-12 pb-6 border-b border-line max-md:flex-col max-md:items-start max-md:gap-4">
          <div>
            <div className="font-mono text-[11px] tracking-[0.2em] text-rust uppercase mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
              Dashboard / Seller view
            </div>
            <h1 className="font-display text-[clamp(40px,5vw,72px)] leading-[0.92] tracking-[-0.03em] uppercase">
              Chào, <span className="text-rust italic">@{user.handle}</span>.
            </h1>
            <p className="text-base text-bone-2 mt-3">
              <span className="font-mono text-bone">{user.reputation_score ?? 0}</span> điểm uy tín ·
              Đã bán: <span className="font-mono text-bone">{user.total_pairs_sold ?? 0}</span> pairs ·
              Tổng: <span className="font-mono text-bone">{formatVnd(user.total_volume_vnd ?? 0)}</span> VNĐ
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link href="/identify" className="border border-rust text-rust py-3 px-5 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-rust/10 transition-colors">
              + Định danh
            </Link>
            <Link href="/submit" className="bg-rust text-ink py-3 px-5 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors group inline-flex items-center gap-2">
              Ký gửi mới <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 border border-line mb-12 max-sm:grid-cols-2">
          <StatCard label="Tổng" value={String(totalItems)} />
          <StatCard label="Đang live" value={String(liveCount)} highlight />
          <StatCard label="Chờ verify" value={String(draftCount)} />
          <StatCard label="Đã bán" value={String(soldCount)} last />
        </div>

        {/* ── Vật phẩm định danh ─────────────────────────────────── */}
        {myAssets.length > 0 && (
          <section className="mb-12">
            <div className="font-mono text-[11px] tracking-[0.2em] text-rust uppercase mb-4 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
              Vật phẩm đã định danh / {myAssets.length}
            </div>
            <div className="border border-line">
              {myAssets.map((asset) => {
                const tier     = TIER_BADGE[asset.security_tier]    ?? TIER_BADGE.standard;
                const idStatus = IDENTITY_STATUS[asset.identity_status] ?? IDENTITY_STATUS.unverified;
                const isFirst  = asset.first_claimant_id === user.id;
                const windowOpen = asset.claim_window_expires_at
                  ? new Date(asset.claim_window_expires_at) > new Date()
                  : false;
                const icon = OBJECT_ICON[asset.object_type] ?? '📦';

                return (
                  <Link
                    key={asset.id}
                    href={`/passport/${asset.qr_code}`}
                    className="grid grid-cols-[56px_1fr_auto_auto] gap-4 items-center p-4 border-b border-line last:border-b-0 hover:bg-ink-2 transition-colors"
                  >
                    <div className="w-14 h-14 bg-ink-3 border border-line flex items-center justify-center text-2xl">
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase mb-1 flex gap-2 items-center flex-wrap">
                        <span>{asset.qr_code}</span>
                        <span>·</span>
                        <span className={tier.color}>{tier.label}</span>
                        {isFirst && (
                          <span className="text-rust border border-rust px-1 text-[8px] tracking-[0.15em]">
                            ⭐ THE FIRST
                          </span>
                        )}
                        {windowOpen && !isFirst && (
                          <span className="text-hazard text-[8px] tracking-[0.12em]">⏰ 48H</span>
                        )}
                      </div>
                      <div className="font-display text-base uppercase truncate">
                        {asset.brand} {asset.model}
                      </div>
                      {asset.colorway && (
                        <div className="font-mono text-[11px] text-bone-2 mt-0.5 truncate">{asset.colorway}</div>
                      )}
                    </div>
                    <div className={`font-mono text-[10px] tracking-[0.14em] uppercase ${idStatus.color} max-sm:hidden`}>
                      {idStatus.label}
                    </div>
                    <div className="font-mono text-[10px] text-concrete tracking-[0.1em] uppercase">
                      {timeAgo(asset.created_at)}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Ký gửi bán ─────────────────────────────────────────── */}
        <section className="mb-12">
          <div className="font-mono text-[11px] tracking-[0.2em] text-rust uppercase mb-4 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Ký gửi bán / {myPosts.length}
          </div>
          {myPosts.length === 0 ? (
            <div className="border border-dashed border-line p-12 text-center">
              <div className="font-display text-xl text-concrete uppercase mb-3">Chưa ký gửi pair nào</div>
              <p className="text-bone-2 mb-6 text-sm">Ký gửi đôi giày để bán trên 16Store Floor.</p>
              <Link href="/submit" className="inline-block bg-rust text-ink py-3 px-6 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors">
                Ký gửi ngay →
              </Link>
            </div>
          ) : (
            <div className="border border-line">
              {myPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/lot/${post.lot_id}`}
                  className="grid grid-cols-[80px_1fr_auto_auto_auto] gap-5 items-center p-5 border-b border-line last:border-b-0 hover:bg-ink-2 transition-colors max-sm:grid-cols-[60px_1fr_auto]"
                >
                  <div className="w-[70px] h-[70px] bg-ink-3 border border-line flex items-center justify-center">
                    <SneakerThumb brand={post.brand} colorway={post.colorway} className="w-[90%] h-[90%]" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase mb-1 flex gap-2 items-center">
                      <span>{post.lot_id}</span>
                      <span>·</span>
                      <span>HUB {post.hub_name ?? '—'}</span>
                    </div>
                    <div className="font-display text-base uppercase truncate">{post.model}</div>
                    <div className="font-mono text-[11px] text-bone-2 mt-1">
                      Size {formatSize(post.size_us)} · {conditionLabel(post.condition)}
                    </div>
                  </div>
                  <div className="font-mono text-right max-sm:hidden">
                    <div className="text-lg font-bold text-bone">{formatVnd(post.asking_price_vnd)}</div>
                    <div className="text-[10px] text-concrete tracking-[0.1em] uppercase mt-1">VNĐ</div>
                  </div>
                  <div className={`font-mono text-[11px] tracking-[0.14em] uppercase ${STATUS_LABELS[post.status as PostStatus]?.color ?? 'text-concrete'} max-sm:hidden`}>
                    {STATUS_LABELS[post.status as PostStatus]?.label ?? post.status}
                  </div>
                  <div className="font-mono text-[10px] text-concrete tracking-[0.1em] uppercase max-sm:hidden">
                    {timeAgo(post.created_at)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Empty state */}
        {totalItems === 0 && (
          <div className="border border-dashed border-line p-16 text-center mb-12">
            <div className="font-display text-2xl text-concrete uppercase mb-3">Chưa có gì</div>
            <p className="text-bone-2 mb-6">Định danh vật phẩm hoặc ký gửi đôi giày đầu tiên.</p>
            <div className="flex gap-4 justify-center">
              <Link href="/identify" className="border border-rust text-rust py-3 px-6 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-rust/10 transition-colors">Định danh →</Link>
              <Link href="/submit" className="bg-rust text-ink py-3 px-6 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors">Ký gửi →</Link>
            </div>
          </div>
        )}

        {/* Telegram */}
        <div className="mt-4 pt-12 border-t border-line">
          <div className="font-mono text-[11px] tracking-[0.2em] text-rust uppercase mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Cài đặt thông báo
          </div>
          <h2 className="font-display text-2xl uppercase mb-4">Telegram</h2>
          {user.telegram_chat_id ? (
            <div className="flex items-center gap-4 text-bone-2">
              <span className="text-[#6ec070]">●</span>
              Đã liên kết với @{user.telegram_username ?? 'unknown'}
              <Link href="/settings" className="font-mono text-[11px] text-rust tracking-[0.14em] uppercase hover:underline">Quản lý →</Link>
            </div>
          ) : (
            <div>
              <p className="text-bone-2 mb-4">Liên kết Telegram để nhận thông báo realtime.</p>
              <Link href="/settings" className="inline-block border border-rust text-rust py-3 px-6 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-rust hover:text-ink transition-colors">
                Liên kết Telegram →
              </Link>
            </div>
          )}
        </div>

      </main>
    </>
  );
}

function StatCard({ label, value, highlight, last }: {
  label: string; value: string; highlight?: boolean; last?: boolean;
}) {
  return (
    <div className={`p-6 ${last ? '' : 'border-r border-line'} ${highlight ? 'bg-rust/5' : ''}`}>
      <div className="font-mono text-[10px] text-concrete tracking-[0.16em] uppercase mb-2">{label}</div>
      <div className={`font-display text-3xl ${highlight ? 'text-rust' : 'text-bone'}`}>{value}</div>
    </div>
  );
}
