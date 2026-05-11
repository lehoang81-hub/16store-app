import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/queries/current-user';
import { getPendingPostsByHub, getHubAdminStats } from '@/lib/queries/admin';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/Nav';
import { formatVnd, timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ hubId: string }>;
}

export default async function HubDetailPage({ params }: PageProps) {
  const { hubId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?redirect=/admin/hub/${hubId}`);

  const supabase = await createClient();
  const { data: hub } = await supabase.from('hubs').select('*').eq('id', hubId).single();
  if (!hub) notFound();

  const isSuperAdmin = user.role === 'super_admin';
  // Schema mới: check qua users_view.hub_id (không có managed_by_user_id)
  const isHubManager = user.hub_id === hub.id;

  if (!isSuperAdmin && !isHubManager) {
    return (
      <>
        <Nav />
        <main className="max-w-[700px] mx-auto px-8 py-20 text-center">
          <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-3">⛔ Không có quyền</div>
          <h1 className="font-display text-3xl uppercase mb-4">Bạn không quản lý hub này</h1>
          <Link href="/admin/hub" className="font-mono text-xs text-rust tracking-[0.2em] uppercase hover:text-bone transition-colors">
            ← Hub Dashboard
          </Link>
        </main>
      </>
    );
  }

  const [pendingPosts, stats] = await Promise.all([
    getPendingPostsByHub(hub.id),
    getHubAdminStats(hub.id),
  ]);

  return (
    <>
      <Nav />
      <main className="max-w-[1400px] mx-auto px-8 py-10 max-md:px-5">

        {/* Breadcrumb */}
        <div className="mb-8 font-mono text-[10px] tracking-[0.2em] uppercase text-concrete">
          {isSuperAdmin ? (
            <>
              <Link href="/admin/hub" className="hover:text-rust transition-colors">ALL HUBS</Link>
              <span className="mx-2">/</span>
              <span className="text-bone">{hub.code}</span>
            </>
          ) : (
            <>
              <Link href="/admin/hub" className="hover:text-rust transition-colors">HUB ADMIN</Link>
              <span className="mx-2">/</span>
              <span className="text-bone">{hub.code}</span>
            </>
          )}
        </div>

        {/* Header */}
        <div className="mb-10 pb-8 border-b border-line">
          <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Hub · {hub.code} · Status {hub.status}
          </div>
          <h1 className="font-display text-[clamp(40px,5vw,72px)] uppercase leading-[0.92] mb-3">
            {hub.name}
          </h1>
          <div className="font-body text-base text-bone-2 mb-4">
            {hub.address}, {hub.city}
          </div>
          <div className="grid grid-cols-3 gap-8 max-md:grid-cols-1 pt-4 border-t border-line">
            <InfoRow label="Capacity" value={`${hub.active_lots ?? 0} / ${hub.capacity ?? 0} lots`} />
            <InfoRow
              label="Mở cửa"
              value={
                hub.opens_at && hub.closes_at
                  ? `${hub.opens_at} - ${hub.closes_at}`
                  : '9:00 - 21:00'
              }
            />
            <InfoRow label="Verifiers" value={`${hub.verifier_count ?? 0} người`} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-0 border border-line mb-10 max-md:grid-cols-2 max-md:border-b-0">
          <StatCard label="Chờ verify" value={stats.pending_verify} highlight />
          <StatCard label="Chờ thanh toán" value={stats.pending_payment} />
          <StatCard label="Đang live" value={stats.live} />
          <StatCard label="Đã bán MTD" value={stats.sold_mtd} />
          <StatCard label="Revenue MTD" value={`${formatVnd(stats.revenue_mtd)}`} isMoney />
        </div>

        {/* Pending list */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
              Pairs cần verify · {pendingPosts.length}
            </div>
          </div>

          {pendingPosts.length === 0 ? (
            <div className="border border-dashed border-line p-16 text-center">
              <div className="font-display text-5xl text-concrete mb-3">○</div>
              <div className="font-display text-xl uppercase text-bone-2 mb-2">
                Hub không có pair chờ verify
              </div>
              <div className="font-mono text-[11px] text-concrete tracking-[0.14em]">
                Tất cả pairs tại hub này đã được xử lý.
              </div>
            </div>
          ) : (
            <div className="border border-line">
              {pendingPosts.map((post, idx) => (
                <Link
                  key={post.id}
                  href={`/admin/hub/verify/${post.lot_id}`}
                  className={`grid grid-cols-[100px_1fr_auto_auto] gap-6 items-center p-5 hover:bg-ink/50 transition-colors ${
                    idx < pendingPosts.length - 1 ? 'border-b border-line' : ''
                  }`}
                >
                  <div className="w-[90px] h-[90px] bg-ink/50 border border-line flex items-center justify-center overflow-hidden">
                    {post.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.cover_image_url} alt={post.lot_id} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-mono text-[10px] text-concrete">NO IMG</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex gap-2 items-center mb-1 font-mono text-[9px] tracking-[0.14em] text-concrete uppercase">
                      <span className="text-rust">{post.lot_id}</span>
                      <span>·</span>
                      <span>@{(post as any).seller_handle}</span>
                      <span>·</span>
                      <span>{timeAgo(post.created_at)}</span>
                    </div>
                    <div className="font-display text-base uppercase mb-1 truncate">
                      {post.brand} {post.model}
                    </div>
                    <div className="font-mono text-[10px] text-bone-2 tracking-[0.1em]">
                      Size {post.size_us} · {post.condition}
                      {post.ai_confidence && ` · AI ${(post.ai_confidence * 100).toFixed(0)}%`}
                    </div>
                  </div>

                  <div className="font-mono text-right min-w-[100px]">
                    <div className="text-base font-bold text-bone">{formatVnd(post.asking_price_vnd)}</div>
                    <div className="text-[10px] text-concrete tracking-[0.14em] uppercase">VNĐ</div>
                  </div>

                  <div className="font-mono text-[10px] text-rust tracking-[0.18em] uppercase whitespace-nowrap">
                    Verify →
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </main>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-concrete tracking-[0.18em] uppercase mb-1">{label}</div>
      <div className="font-display text-base text-bone">{value}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
  isMoney = false,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  isMoney?: boolean;
}) {
  return (
    <div className={`p-6 border-r border-line last:border-r-0 max-md:border-b max-md:last:border-b-0 ${highlight ? 'bg-rust/5' : ''}`}>
      <div className="font-mono text-[10px] text-bone-2 tracking-[0.18em] uppercase mb-2">{label}</div>
      <div className={`font-display ${isMoney ? 'text-xl' : 'text-4xl'} ${highlight ? 'text-rust' : isMoney ? 'text-[#6ec070]' : 'text-bone'}`}>
        {value}
        {isMoney && <span className="text-xs text-concrete ml-1">VNĐ</span>}
      </div>
    </div>
  );
}
