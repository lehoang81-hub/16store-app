import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/queries/current-user';
import { getSuperAdminOverview } from '@/lib/queries/admin';
import { Nav } from '@/components/Nav';
import { formatVnd } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/admin/overview');

  if (user.role !== 'super_admin') {
    return (
      <>
        <Nav />
        <main className="max-w-[700px] mx-auto px-8 py-20 text-center">
          <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-3">⛔ Chỉ Super Admin</div>
          <h1 className="font-display text-3xl uppercase mb-4">
            Trang dành riêng cho{' '}
            <span className="font-serif italic text-rust normal-case">super admin</span>
          </h1>
          <p className="text-bone/70 mb-8">
            Bạn đang là {user.role ?? 'seller'}. Hãy vào dashboard hub nếu bạn là hub admin.
          </p>
          <Link
            href={user.role === 'hub_admin' ? '/admin/hub' : '/'}
            className="font-mono text-xs text-rust tracking-[0.2em] uppercase hover:text-bone transition-colors"
          >
            ← Quay lại
          </Link>
        </main>
      </>
    );
  }

  const overview = await getSuperAdminOverview();

  return (
    <>
      <Nav />
      <main className="max-w-[1400px] mx-auto px-8 py-10 max-md:px-5">

        {/* Header */}
        <div className="mb-10 pb-6 border-b border-line">
          <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Super Admin · 16STORE Overview
          </div>
          <h1 className="font-display text-[clamp(40px,5vw,64px)] uppercase leading-[0.95] mb-3">
            Toàn hệ thống<br />
            <span className="font-serif italic text-rust normal-case">real-time</span>
          </h1>
          <div className="font-mono text-[10px] text-concrete tracking-[0.16em] uppercase">
            Cập nhật: {new Date().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
          </div>
        </div>

        {/* Global stats */}
        <div className="grid grid-cols-5 gap-0 border border-line mb-10 max-md:grid-cols-2 max-md:border-b-0">
          <BigStatCard label="Chờ verify" value={overview.total_pending} highlight />
          <BigStatCard label="Đang live" value={overview.total_live} />
          <BigStatCard label="Đã bán" value={overview.total_sold} />
          <BigStatCard label="Users" value={overview.total_users} />
          <BigStatCard
            label="Revenue MTD"
            value={`${formatVnd(overview.revenue_mtd)} VNĐ`}
            isMoney
          />
        </div>

        {/* Bottleneck alert */}
        {overview.bottleneck_hubs.length > 0 && (
          <div className="mb-10 border border-hazard bg-hazard/10 p-5">
            <div className="font-mono text-[10px] text-hazard tracking-[0.2em] uppercase mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-hazard">
              ⚠ Bottleneck alert
            </div>
            <p className="text-sm text-bone mb-3">
              Các hub có quá nhiều pair pending:
            </p>
            <div className="flex flex-wrap gap-2">
              {overview.bottleneck_hubs.map((h) => (
                <Link
                  key={h.id}
                  href={`/admin/hub/${h.id}`}
                  className="font-mono text-[11px] tracking-[0.14em] uppercase bg-hazard/20 text-hazard px-3 py-2 border border-hazard hover:bg-hazard hover:text-ink transition-colors"
                >
                  {h.name} · {h.pending} pending →
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Hub performance */}
        <div>
          <div className="font-mono text-[10px] text-bone/70 tracking-[0.2em] uppercase mb-5 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Hub performance · Sắp xếp theo revenue MTD
          </div>

          <div className="border border-line">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 p-4 border-b border-line bg-ink/50 font-mono text-[9px] text-concrete tracking-[0.18em] uppercase">
              <div>Hub</div>
              <div className="text-right">Pending</div>
              <div className="text-right">Live</div>
              <div className="text-right">Sold MTD</div>
              <div className="text-right">Revenue MTD</div>
              <div className="text-right">Action</div>
            </div>

            {overview.hubs.map((hub, idx) => (
              <div
                key={hub.id}
                className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 p-4 items-center hover:bg-ink/50 transition-colors ${
                  idx < overview.hubs.length - 1 ? 'border-b border-line' : ''
                }`}
              >
                <div>
                  <div className="font-display text-base uppercase mb-1">{hub.name}</div>
                  <div className="font-mono text-[10px] text-concrete tracking-[0.14em]">
                    {hub.code} · {hub.city} · {hub.status}
                  </div>
                </div>

                <div className={`text-right font-display text-xl ${hub.pending > 5 ? 'text-hazard' : hub.pending > 0 ? 'text-rust' : 'text-bone/50'}`}>
                  {hub.pending}
                </div>

                <div className="text-right font-display text-xl text-bone">{hub.live}</div>

                <div className="text-right font-display text-xl text-bone">{hub.sold_mtd}</div>

                <div className="text-right">
                  <div className="font-display text-base text-[#6ec070]">
                    {hub.revenue_mtd > 0 ? `${formatVnd(hub.revenue_mtd)}` : '—'}
                  </div>
                  <div className="font-mono text-[9px] text-concrete tracking-[0.14em]">VNĐ</div>
                </div>

                <Link
                  href={`/admin/hub/${hub.id}`}
                  className="font-mono text-[10px] text-rust tracking-[0.18em] uppercase hover:text-bone transition-colors whitespace-nowrap"
                >
                  Xem →
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* System info */}
        <div className="mt-10 pt-8 border-t border-line grid grid-cols-3 gap-8 max-md:grid-cols-1">
          <InfoItem label="Hub admins" value={`${overview.total_hub_admins} người`} />
          <InfoItem label="Tổng pairs trên hệ thống" value={`${overview.total_pairs}`} />
          <InfoItem
            label="Active hubs"
            value={`${overview.hubs.filter((h) => h.status === 'open').length}/${overview.hubs.length}`}
          />
        </div>

      </main>
    </>
  );
}

function BigStatCard({
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
      <div className="font-mono text-[10px] text-bone/70 tracking-[0.18em] uppercase mb-2">{label}</div>
      <div className={`font-display ${isMoney ? 'text-2xl' : 'text-4xl'} ${highlight ? 'text-rust' : isMoney ? 'text-[#6ec070]' : 'text-bone'}`}>
        {value}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-concrete tracking-[0.18em] uppercase mb-1">{label}</div>
      <div className="font-display text-xl text-bone">{value}</div>
    </div>
  );
}
