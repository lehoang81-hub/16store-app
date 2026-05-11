import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPostByLotId } from '@/lib/queries/posts';
import { createServiceClient } from '@/lib/supabase/service';
import { Nav } from '@/components/Nav';
import { LotImageGallery } from '@/components/LotImageGallery';
import { MemoryMapMini } from '@/components/MemoryMapMini';
import { SocialCardGenerator } from '@/components/SocialCardGenerator';
import { BuyButton } from '@/components/BuyButton';
import { HotspotViewer } from '@/components/HotspotViewer';
import { formatVnd } from '@/lib/utils';
import FavoriteButton from '@/components/FavoriteButton'
import ViewTracker from '@/components/ViewTracker'
import { assetTypeLabel } from '@/components/SneakerThumb'

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: Promise<{ lotId: string }>;
}

const CONDITION_LABELS: Record<string, string> = {
  DS: 'Deadstock',
  VNDS: 'Very Near Deadstock',
  '9_5': '9.5/10 — Như mới',
  '9': '9/10 — Đẹp',
  '8_5': '8.5/10 — Khá',
  '8': '8/10 — Cũ',
};

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  live: { text: 'Đang mở bán', color: 'text-[#6ec070]' },
  reserved: { text: 'Đã được giữ', color: 'text-hazard' },
  sold: { text: 'Đã bán', color: 'text-concrete' },
  pending_verify: { text: 'Chờ verify', color: 'text-hazard' },
  pending_payment: { text: 'Chờ thanh toán', color: 'text-hazard' },
};

const BADGE_CONFIG: Record<string, { icon: string; color: string }> = {
  bronze:   { icon: '🥉', color: 'text-[#cd7f32]' },
  silver:   { icon: '🥈', color: 'text-[#a8a89d]' },
  gold:     { icon: '🥇', color: 'text-hazard'     },
  platinum: { icon: '💎', color: 'text-[#6ec070]'  },
}

export default async function LotDetailPage({ params }: PageProps) {
  const { lotId } = await params;
  const normalizedLotId = lotId.toUpperCase().includes('-') ? lotId.toUpperCase() : `A-${lotId}`;

  const post = await getPostByLotId(normalizedLotId);
  if (!post) notFound();

  const supabase = createServiceClient();
  const assetType = (post as any).asset_type ?? 'sneaker'
  const isSneaker = assetType === 'sneaker'

  const { data: passport } = await supabase
    .from('shoe_passports')
    .select('id, qr_code, status, total_scans')
    .eq('current_post_id', post.id)
    .maybeSingle();

  const { data: passportScans } = passport
    ? await supabase
        .from('scan_events')
        .select('id, scan_type, city, country, location_lat, location_lng, created_at')
        .eq('passport_id', passport.id)
        .eq('is_meaningful', true)
        .order('created_at', { ascending: false })
        .limit(30)
    : { data: [] };

  const { data: hotspot } = await supabase
    .from('hotspots')
    .select('*')
    .eq('post_id', post.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: sellerReviews } = post.seller_id
    ? await supabase
        .from('reviews')
        .select('rating')
        .eq('reviewee_id', post.seller_id)
        .eq('review_type', 'buyer_to_seller')
        .eq('is_visible', true)
    : { data: [] }

  const { data: sellerData } = post.seller_id
    ? await supabase
        .from('users')
        .select('badge, reputation_score')
        .eq('id', post.seller_id)
        .single()
    : { data: null }

  const sellerRatingAvg = sellerReviews && sellerReviews.length > 0
    ? sellerReviews.reduce((sum, r) => sum + r.rating, 0) / sellerReviews.length
    : null
  const sellerRatingCount = sellerReviews?.length ?? 0
  const sellerBadge = sellerData?.badge ?? 'bronze'
  const badgeConfig = BADGE_CONFIG[sellerBadge] ?? BADGE_CONFIG.bronze

  const verifyCount = [post.verify_stitching, post.verify_sole, post.verify_materials, post.verify_box].filter(Boolean).length;
  const isFullyVerified = verifyCount === 4;
  const statusInfo = STATUS_LABELS[post.status] ?? { text: post.status, color: 'text-bone-2' };
  const aiExtracted = post.ai_extracted as Record<string, unknown> | null;
  const strategyAdvice = aiExtracted && typeof aiExtracted === 'object' && 'strategy_advice' in aiExtracted
    ? (aiExtracted.strategy_advice as string)
    : null;

  const isMystery = (post as any).is_mystery === true && post.status !== 'sold'

  const coverImage = post.cover_image_url ?? post.image_urls?.[0] ?? null

  // Tên hiển thị
  const displayName = post.model && post.model !== 'Unknown'
    ? post.model
    : assetTypeLabel(assetType)

  // asset_attributes từ DB
  const assetAttributes = (post as any).asset_attributes as Record<string, any> | null

  return (
    <>
      <Nav />
      <main className="max-w-[1400px] mx-auto px-8 py-10 max-md:px-5 max-md:py-6">

        {/* Breadcrumb */}
        <div className="mb-8 font-mono text-[10px] tracking-[0.2em] uppercase text-concrete">
          <Link href="/" className="hover:text-rust transition-colors">TRANG CHỦ</Link>
          <span className="mx-2">/</span>
          <Link href="/#floor" className="hover:text-rust transition-colors">FLOOR</Link>
          <span className="mx-2">/</span>
          <span className="text-bone">LOT {post.lot_id}</span>
        </div>

        {/* Mystery Box Banner */}
        {isMystery && (
          <div className="mb-8 border border-hazard bg-hazard/5 p-5 flex items-center gap-4">
            <div className="font-display text-4xl text-hazard">?</div>
            <div>
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-hazard mb-1">✦ Mystery Box · Blind Purchase</div>
              <p className="font-mono text-[11px] text-bone-2 leading-relaxed">
                Thông tin vật phẩm này được ẩn cho đến khi bạn hoàn tất mua hàng.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-12 max-lg:grid-cols-1 max-lg:gap-8">

          {/* Left */}
          <div className="max-lg:order-1 space-y-6">
            {isMystery ? (
              <div className="aspect-square border border-hazard/30 bg-ink-2 flex flex-col items-center justify-center gap-4">
                <div className="font-display text-[120px] text-hazard/20 leading-none">?</div>
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-hazard">Ảnh sẽ hiện sau khi mua</div>
              </div>
            ) : (
              <>
                <LotImageGallery
                  images={post.image_urls ?? []}
                  coverImage={post.cover_image_url}
                  lotId={post.lot_id}
                  brand={post.brand}
                  model={post.model}
                />
                {coverImage && (
                  <div className="border border-line p-4">
                    <HotspotViewer
                      postId={post.id}
                      imageUrl={coverImage}
                      initialSpots={hotspot?.spots ?? null}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right */}
          <div className="max-lg:order-2 space-y-8">

            {/* Header */}
            <div>
              <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-2 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
                LOT // {post.lot_id}
              </div>
              {/* Asset type tag */}
              {!isSneaker && (
                <div className="font-mono text-[10px] text-bone-2 tracking-[0.18em] uppercase mb-2">
                  {assetTypeLabel(assetType)}
                </div>
              )}

              {isMystery ? (
                <div>
                  <h1 className="font-display text-[clamp(32px,4vw,56px)] leading-[0.95] tracking-[-0.02em] uppercase mb-3 text-hazard/40">??? ??? ???</h1>
                  <div className="font-serif italic text-2xl text-hazard/40">&ldquo;Secret&rdquo;</div>
                </div>
              ) : (
                <div>
                  {isSneaker && (
                    <div className="font-mono text-[11px] text-bone-2 tracking-[0.18em] uppercase mb-3">{post.brand}</div>
                  )}
                  <h1 className="font-display text-[clamp(32px,4vw,56px)] leading-[0.95] tracking-[-0.02em] uppercase mb-3">
                    {displayName}
                  </h1>
                  {post.colorway && isSneaker && (
                    <div className="font-serif italic text-2xl text-rust">&ldquo;{post.colorway}&rdquo;</div>
                  )}
                </div>
              )}
            </div>

            {/* Polished Description */}
            {!isMystery && (post as any).polished_description && (
              <div className="border-y border-line py-6">
                <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase mb-3">✨ Mô tả</div>
                <div className="font-body text-[15px] text-bone leading-[1.75] whitespace-pre-line">{(post as any).polished_description}</div>
              </div>
            )}

            {isMystery && (
              <div className="border-y border-hazard/20 py-6">
                <div className="font-mono text-[10px] text-hazard tracking-[0.2em] uppercase mb-3">✦ Bí ẩn</div>
                <div className="font-body text-[15px] text-bone-2 leading-[1.75] italic">
                  Thông tin chi tiết sẽ được tiết lộ sau khi bạn hoàn tất thanh toán.
                </div>
              </div>
            )}

            {/* Spec Grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {/* Sneaker-specific specs */}
              {isSneaker && (
                <>
                  <SpecItem label="Size US" value={`${post.size_us}`} />
                  <SpecItem label="Tình trạng" value={CONDITION_LABELS[post.condition] ?? post.condition} />
                  {post.release_year && !isMystery && (
                    <SpecItem label="Năm phát hành" value={String(post.release_year)} />
                  )}
                </>
              )}

              {/* Non-sneaker: asset_attributes */}
              {!isSneaker && assetAttributes && Object.entries(assetAttributes).slice(0, 6).map(([key, val]) => (
                <SpecItem key={key} label={key.replace(/_/g, ' ')} value={String(val ?? '—')} />
              ))}

              {/* Tình trạng cho non-sneaker */}
              {!isSneaker && (
                <SpecItem label="Tình trạng" value={CONDITION_LABELS[post.condition] ?? post.condition} />
              )}

              <SpecItem
                label="Hub lưu trữ"
                value={`${post.hub_name ?? '—'}${post.hub_city ? ` · ${post.hub_city}` : ''}`}
              />
              <SpecItem label="Trạng thái" value={statusInfo.text} valueClass={statusInfo.color} />

              {/* Seller + Badge */}
              {!isMystery && (
                <div>
                  <div className="font-mono text-[10px] text-concrete tracking-[0.18em] uppercase mb-1">Người bán</div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base text-bone">@{post.seller_handle ?? 'unknown'}</span>
                    <span title={`${sellerBadge} seller`}>{badgeConfig.icon}</span>
                  </div>
                  {sellerRatingAvg !== null ? (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-hazard text-xs">
                        {'★'.repeat(Math.round(sellerRatingAvg))}{'☆'.repeat(5 - Math.round(sellerRatingAvg))}
                      </span>
                      <span className="font-mono text-[10px] text-concrete">{sellerRatingAvg.toFixed(1)} ({sellerRatingCount})</span>
                    </div>
                  ) : (
                    <div className="font-mono text-[10px] text-concrete mt-1">Chưa có đánh giá</div>
                  )}
                  {sellerData?.reputation_score !== undefined && (
                    <div className={`font-mono text-[10px] mt-1 ${badgeConfig.color}`}>{sellerData.reputation_score} điểm uy tín</div>
                  )}
                </div>
              )}
            </div>

            {/* Price + CTA */}
            <div className="border-t border-line-strong pt-6">
              <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase mb-2">Giá đề xuất</div>
              <div className="flex items-baseline gap-3 mb-1">
                <span className="font-display text-[56px] text-rust leading-none">{formatVnd(post.asking_price_vnd)}</span>
                <span className="font-serif italic text-bone-2 text-xl">VNĐ</span>
              </div>
              {!isMystery && post.market_avg_vnd && post.market_avg_vnd > 0 && (
                <div className="font-mono text-[10px] text-concrete tracking-[0.14em]">
                  Market avg: {formatVnd(post.market_avg_vnd)} VNĐ
                </div>
              )}
              <BuyButton
                lotId={post.lot_id}
                price={post.asking_price_vnd}
                status={post.status}
                statusText={statusInfo.text}
              />
              <FavoriteButton postId={post.id} />
            </div>

            {/* Verification — chỉ hiện cho sneaker */}
            {isSneaker && (
              <div className={`border p-5 ${isFullyVerified ? 'border-rust bg-rust/5' : 'border-line-strong'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`font-mono text-[10px] tracking-[0.2em] uppercase ${isFullyVerified ? 'text-rust' : 'text-bone-2'}`}>
                    {isFullyVerified ? '✓ ĐÃ XÁC THỰC BỞI 16STORE' : `Xác thực: ${verifyCount}/4`}
                  </div>
                  {isFullyVerified && <div className="font-serif italic text-rust text-sm">Authentic</div>}
                </div>
                {!isMystery && (
                  <div className="grid grid-cols-2 gap-2">
                    <VerifyItem label="Đường chỉ" done={post.verify_stitching} />
                    <VerifyItem label="Đế giày" done={post.verify_sole} />
                    <VerifyItem label="Chất liệu" done={post.verify_materials} />
                    <VerifyItem label="Hộp + giấy" done={post.verify_box} />
                  </div>
                )}
              </div>
            )}

            {/* Meta */}
            <div className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase space-y-1 border-t border-line pt-4">
              <div>Đăng: {new Date(post.created_at).toLocaleString('vi-VN')}</div>
              {post.listed_at && <div>Lên floor: {new Date(post.listed_at).toLocaleString('vi-VN')}</div>}
              <div>Lượt xem: {post.view_count ?? 0}</div>
              <ViewTracker lotId={post.lot_id} />
            </div>
          </div>
        </div>

        {/* AI Strategy */}
        {!isMystery && strategyAdvice && (
          <section className="mt-16 border border-rust bg-rust/5 p-8">
            <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
              AI STRATEGY / Chiến lược từ AI
            </div>
            <h2 className="font-display text-2xl uppercase tracking-[-0.01em] mb-4">
              💡 Tại sao <span className="font-serif italic font-normal text-rust normal-case">đáng đầu tư</span>
            </h2>
            <p className="font-body text-base text-bone leading-[1.7] max-w-[780px]">{strategyAdvice}</p>
          </section>
        )}

        {/* Social Card */}
        {!isMystery && passport && (
          <section className="mt-12">
            <SocialCardGenerator
              passportId={passport.id}
              lotId={post.lot_id}
              brand={post.brand}
              model={post.model}
            />
          </section>
        )}

        {/* Memory Map */}
        {!isMystery && passport && passport.qr_code && (
          <section className="mt-12 border-t border-line pt-10">
            <div className="flex items-center justify-between mb-6 max-md:flex-col max-md:items-start max-md:gap-2">
              <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
                HÀNH TRÌNH
              </div>
              <Link href={`/passport/${passport.qr_code}`} className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase hover:text-bone transition-colors">
                Mở hộ chiếu đầy đủ →
              </Link>
            </div>
            {passportScans && passportScans.length > 0 ? (
              <MemoryMapMini scans={passportScans} qrCode={passport.qr_code} height={300} />
            ) : (
              <div className="border border-dashed border-line p-8 text-center">
                <div className="font-display text-2xl text-concrete mb-2">📍</div>
                <div className="font-display text-lg uppercase mb-2">
                  Đang chờ <span className="font-serif italic text-rust normal-case">chuyến đi đầu tiên</span>
                </div>
                <p className="font-body text-sm text-bone-2 max-w-[480px] mx-auto">Vật phẩm đã có hộ chiếu nhưng chưa có hành trình nào.</p>
              </div>
            )}
          </section>
        )}

        {!isMystery && !passport && (
          <section className="mt-12 border-t border-line pt-10">
            <div className="font-mono text-[10px] text-concrete tracking-[0.22em] uppercase mb-4 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-concrete">
              OWNERSHIP / Lịch sử sở hữu
            </div>
            <div className="flex items-center gap-6 opacity-40">
              <div className="flex-1 h-[1px] bg-line" />
              <div className="font-mono text-[11px] text-concrete tracking-[0.14em] uppercase whitespace-nowrap">Chưa có hộ chiếu</div>
              <div className="flex-1 h-[1px] bg-line" />
            </div>
          </section>
        )}

        <div className="mt-16 text-center">
          <Link href="/#floor" className="font-mono text-xs text-bone-2 tracking-[0.2em] uppercase hover:text-rust transition-colors">
            ← QUAY LẠI FLOOR
          </Link>
        </div>
      </main>
    </>
  );
}

function SpecItem({ label, value, valueClass = 'text-bone' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-concrete tracking-[0.18em] uppercase mb-1">{label}</div>
      <div className={`font-display text-base ${valueClass}`}>{value}</div>
    </div>
  );
}

function VerifyItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`font-mono text-xs ${done ? 'text-rust' : 'text-concrete'}`}>{done ? '✓' : '○'}</span>
      <span className={`font-mono text-[11px] tracking-[0.1em] ${done ? 'text-bone' : 'text-concrete'}`}>{label}</span>
    </div>
  );
}