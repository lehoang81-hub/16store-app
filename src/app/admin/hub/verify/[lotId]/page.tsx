import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/queries/current-user';
import { getPostByLotId } from '@/lib/queries/posts';
import { getMyManagedHub } from '@/lib/queries/admin';
import { Nav } from '@/components/Nav';
import { LotImageGallery } from '@/components/LotImageGallery';
import { VerifyChecklist } from '@/components/VerifyChecklist';
import { QRDownloadPanel } from '@/components/QRDownloadPanel';
import { formatVnd } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ lotId: string }>;
}

const CONDITION_LABELS: Record<string, string> = {
  DS: 'Deadstock',
  VNDS: 'Very Near Deadstock',
  '9_5': '9.5/10',
  '9': '9/10',
  '8_5': '8.5/10',
  '8': '8/10',
};

export default async function VerifyPostPage({ params }: PageProps) {
  const { lotId } = await params;
  const user = await getCurrentUser();

  if (!user) redirect(`/login?redirect=/admin/hub/verify/${lotId}`);
  if (user.role !== 'hub_admin' && user.role !== 'super_admin') {
    redirect('/admin/hub');
  }

  const post = await getPostByLotId(lotId.toUpperCase());
  if (!post) notFound();

  const isSuperAdmin = user.role === 'super_admin';
  const managedHub = isSuperAdmin ? null : await getMyManagedHub(user.id);
  const canVerify = isSuperAdmin || (managedHub && managedHub.id === post.hub_id);

  if (!canVerify) {
    return (
      <>
        <Nav />
        <main className="max-w-[700px] mx-auto px-8 py-20 text-center">
          <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-3">⛔ Không có quyền</div>
          <h1 className="font-display text-3xl uppercase mb-4">Pair này thuộc hub khác</h1>
          <p className="text-bone-2 mb-8">Bạn chỉ có thể verify pair thuộc hub bạn quản lý.</p>
          <Link href="/admin/hub" className="font-mono text-xs text-rust tracking-[0.2em] uppercase hover:text-bone transition-colors">
            ← Quay lại Hub Dashboard
          </Link>
        </main>
      </>
    );
  }

  // Schema mới: status bắt đầu từ 'draft' (không phải 'pending_verify')
  if (post.status !== 'draft') {
    return (
      <>
        <Nav />
        <main className="max-w-[700px] mx-auto px-8 py-20 text-center">
          <div className="font-mono text-[10px] text-hazard tracking-[0.22em] uppercase mb-3">⚠ Không thể verify</div>
          <h1 className="font-display text-3xl uppercase mb-4">
            Pair đang ở trạng thái{' '}
            <span className="font-serif italic text-rust normal-case">{post.status}</span>
          </h1>
          <p className="text-bone-2 mb-8">Chỉ verify được các pair có trạng thái &ldquo;draft&rdquo;.</p>
          <Link href="/admin/hub" className="font-mono text-xs text-rust tracking-[0.2em] uppercase hover:text-bone transition-colors">
            ← Quay lại Hub Dashboard
          </Link>
        </main>
      </>
    );
  }

  const aiExtracted = post.ai_extracted as Record<string, unknown> | null;
  const riskFlags = post.ai_risk_flags ?? [];
  const aiStrategy = aiExtracted && 'strategy_advice' in aiExtracted
    ? (aiExtracted.strategy_advice as string)
    : null;

  return (
    <>
      <Nav />
      <main className="max-w-[1400px] mx-auto px-8 py-10 max-md:px-5">

        {/* Breadcrumb */}
        <div className="mb-8 font-mono text-[10px] tracking-[0.2em] uppercase text-concrete">
          <Link href="/admin/hub" className="hover:text-rust transition-colors">HUB ADMIN</Link>
          <span className="mx-2">/</span>
          <span className="text-bone">VERIFY · {post.lot_id}</span>
        </div>

        {/* Title */}
        <div className="mb-10 pb-6 border-b border-line">
          <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-2">
            Bước verify 4 điểm · {(post as any).hub_name}
          </div>
          <h1 className="font-display text-[clamp(32px,4vw,56px)] uppercase leading-[0.95]">
            {post.brand} {post.model}
          </h1>
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-[1.2fr_1fr] gap-10 max-lg:grid-cols-1">

          {/* Left — Images + Info */}
          <div className="space-y-8">
            <LotImageGallery
              images={post.image_urls ?? []}
              coverImage={post.cover_image_url}
              lotId={post.lot_id}
              brand={post.brand}
              model={post.model}
            />

            {/* Info spec */}
            <div className="grid grid-cols-2 gap-4 border-t border-line pt-6">
              <SpecRow label="Size" value={`${post.size_us} US`} />
              <SpecRow label="Condition" value={CONDITION_LABELS[post.condition] ?? post.condition} />
              <SpecRow label="Colorway" value={post.colorway ?? '—'} />
              <SpecRow label="Year" value={post.release_year ? String(post.release_year) : '—'} />
              <SpecRow label="Asking price" value={`${formatVnd(post.asking_price_vnd)} VNĐ`} />
              <SpecRow label="Seller" value={`@${(post as any).seller_handle ?? 'unknown'}`} />
            </div>

            {/* AI warnings */}
            {aiStrategy && (
              <div className="border-t border-line pt-6">
                <div className="font-mono text-[10px] text-rust tracking-[0.18em] uppercase mb-2">
                  💡 AI Strategy Advice
                </div>
                <div className="font-body text-sm text-bone leading-[1.6]">{aiStrategy}</div>
              </div>
            )}

            {riskFlags.length > 0 && (
              <div className="border border-hazard bg-hazard/5 p-5">
                <div className="font-mono text-[10px] text-hazard tracking-[0.2em] uppercase mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-hazard">
                  ⚠ AI Risk Flags · Kiểm tra kỹ
                </div>
                <div className="flex flex-wrap gap-2">
                  {riskFlags.map((f) => (
                    <span
                      key={f}
                      className="font-mono text-[10px] tracking-[0.1em] uppercase bg-hazard/20 text-hazard px-2 py-1 border border-hazard"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — Checklist action */}
          <div className="lg:sticky lg:top-24 lg:self-start space-y-6">
            <VerifyChecklist postId={post.id} lotId={post.lot_id} />
            <QRDownloadPanel postId={post.id} lotId={post.lot_id} />
          </div>

        </div>
      </main>
    </>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-concrete tracking-[0.16em] uppercase mb-1">{label}</div>
      <div className="font-display text-base text-bone">{value}</div>
    </div>
  );
}
