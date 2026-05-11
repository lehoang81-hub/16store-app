import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/queries/current-user';
import { getMyManagedHub, getPendingPostsByHub, getHubAdminStats, getAllHubsForAdmin } from '@/lib/queries/admin';
import { Nav } from '@/components/Nav';
import Link from 'next/link';
import { formatVnd, timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function HubAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/admin/hub');

  if (user.role !== 'hub_admin' && user.role !== 'super_admin') {
    return (
      <>
        <Nav />
        <main className="max-w-[700px] mx-auto px-8 py-20 text-center">
          <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-3">⛔ Không có quyền</div>
          <h1 className="font-display text-4xl uppercase mb-4">
            Trang dành cho <span className="font-serif italic text-rust normal-case">hub admin</span>
          </h1>
          <p className="text-bone-2 mb-8">
            Bạn cần có quyền hub_admin để truy cập trang này.
          </p>
          <Link href="/" className="font-mono text-xs text-rust tracking-[0.2em] uppercase hover:text-bone transition-colors">
            ← Trang chủ
          </Link>
        </main>
      </>
    );
  }

  const isSuperAdmin = user.role === 'super_admin';
  const managedHub = isSuperAdmin ? null : await getMyManagedHub(user.id);
  const allHubs = isSuperAdmin ? await getAllHubsForAdmin() : [];

  if (!isSuperAdmin && !managedHub) {
    return (
      <>
        <Nav />
        <main className="max-w-[700px] mx-auto px-8 py-20 text-center">
          <div className="font-mono text-[10px] text-hazard tracking-[0.22em] uppercase mb-3">⚠ Chưa được gán hub</div>
          <h1 className="font-display text-4xl uppercase mb-4">
            Tài khoản của bạn<br />
            <span className="font-serif italic text-rust normal-case">chưa quản lý</span> hub nào
          </h1>
          <p className="text-bone-2 mb-8">Vui lòng liên hệ 16Store để được gán hub quản lý.</p>
          <Link href="/" className="font-mono text-xs text-rust tracking-[0.2em] uppercase hover:text-bone transition-colors">
            ← Trang chủ
          </Link>
        </main>
      </>
    );
  }

  // Super admin — chọn hub
  if (isSuperAdmin) {
    return (
      <>
        <Nav />
        <main className="max-w-[1100px] mx-auto px-8 py-12">
          <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Admin / Super admin · Tất cả hub
          </div>
          <h1 className="font-display text-5xl uppercase mb-10">
            Chọn <span className="font-serif italic text-rust normal-case">hub</span> để quản lý
          </h1>
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            {allHubs.map((h) => (
              <Link
                key={h.id}
                href={`/admin/hub/${h.id}`}
                className="border border-line p-6 hover:border-rust transition-colors group"
              >
                <div className="font-mono text-[10px] text-concrete tracking-[0.18em] uppercase mb-2 group-hover:text-rust transition-colors">
                  {h.code}
                </div>
                <div className="font-display text-2xl uppercase mb-2">{h.name}</div>
                <div className="text-sm text-bone-2 mb-3">{h.address}</div>
                <div className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase">
                  {h.active_lots}/{h.capacity} lots · Status {h.status}
                </div>
              </Link>
            ))}
          </div>
        </main>
      </>
    );
  }

  return <HubDashboard hubId={managedHub!.id} hubName={managedHub!.name} />;
}

async function HubDashboard({ hubId, hubName }: { hubId: string; hubName: string }) {
  const [pendingPosts, stats] = await Promise.all([
    getPendingPostsByHub(hubId),
    getHubAdminStats(hubId),
  ]);

  return (
    <>
      <Nav />
      <main className="max-w-[1400px] mx-auto px-8 py-10 max-md:px-5 max-md:py-6">

        {/* Header */}
        <div className="mb-10 border-b border-line pb-8">
          <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Hub Admin / {hubName}
          </div>
          <h1 className="font-display text-[clamp(40px,5vw,64px)] uppercase leading-[0.95]">
            Trung tâm<br />
            <span className="font-serif italic text-rust normal-case">xác thực</span>
          </h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-0 border border-line mb-10 max-md:grid-cols-2 max-md:border-b-0">
          <StatCard label="Chờ verify" value={stats.pending_verify} highlight />
          <StatCard label="Chờ thanh toán" value={stats.pending_payment} />
          <StatCard label="Đang live" value={stats.live} />
          <StatCard label="Đã bán" value={stats.sold} />
          <StatCard label="Tổng" value={stats.total} />
        </div>

        {/* Pending list */}
        <div>
          <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase mb-5 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Pairs cần verify · {pendingPosts.length}
          </div>

          {pendingPosts.length === 0 ? (
            <div className="border border-dashed border-line p-16 text-center">
              <div className="font-display text-5xl text-concrete mb-3">○</div>
              <div className="font-display text-xl uppercase text-bone-2 mb-2">
                Không có pair nào chờ verify
              </div>
              <div className="font-mono text-[11px] text-concrete tracking-[0.14em]">
                Khi có user submit pair đến hub này, chúng sẽ xuất hiện ở đây.
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
                  {/* Thumbnail */}
                  <div className="w-[90px] h-[90px] bg-ink/50 border border-line flex items-center justify-center overflow-hidden">
                    {post.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.cover_image_url}
                        alt={post.lot_id}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-mono text-[10px] text-concrete">NO IMG</span>
                    )}
                  </div>

                  {/* Info */}
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
                      {post.ai_confidence && ` · AI conf ${(post.ai_confidence * 100).toFixed(0)}%`}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="font-mono text-right min-w-[100px]">
                    <div className="text-base font-bold text-bone">
                      {formatVnd(post.asking_price_vnd)}
                    </div>
                    <div className="text-[10px] text-concrete tracking-[0.14em] uppercase">VNĐ</div>
                  </div>

                  {/* CTA */}
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

function StatCard({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`p-6 border-r border-line last:border-r-0 max-md:border-b max-md:last:border-b-0 ${highlight ? 'bg-rust/5' : ''}`}>
      <div className="font-mono text-[10px] text-bone-2 tracking-[0.18em] uppercase mb-2">{label}</div>
      <div className={`font-display text-4xl ${highlight ? 'text-rust' : 'text-bone'}`}>{value}</div>
    </div>
  );
}
