import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/Nav';
import { ScanRecorder } from '@/components/ScanRecorder';
import { MemoryMap } from '@/components/MemoryMap';
import { ShareButton } from '@/components/ShareButton';
import { SocialCardGenerator } from '@/components/SocialCardGenerator';
import { JourneyScore } from '@/components/JourneyScore';
import { LostFoundOwnerPanel } from '@/components/LostFoundOwnerPanel';
import { PassportActions } from '@/components/PassportActions';
import { QRMiniDisplay, IDParticleBadge } from '@/components/QRBadge';
import { IdentityPosterButton } from '@/components/IdentityPosterButton';
import { IdentityTierBadge } from '@/components/IdentityTierBadge';
import { formatVnd } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ qrCode: string }>;
  searchParams?: Promise<{ action?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { qrCode } = await params;
  try {
    const supabase = createServiceClient();

    // Schema mới: không có total_scans/total_owners → COUNT
    const { data: passport } = await supabase
      .from('universal_assets')
      .select('id, qr_code, post_id')
      .eq('qr_code', qrCode)
      .single();

    if (!passport) return { title: '16Store Passport' };

    const { data: post } = passport.post_id
      ? await supabase
          .from('posts_with_seller')
          .select('brand, model, colorway, lot_id')
          .eq('id', passport.post_id)
          .single()
      : { data: null };

    // COUNT scans thay vì dùng total_scans column
    const { count: scanCount } = await supabase
      .from('scan_events')
      .select('*', { count: 'exact', head: true })
      .eq('passport_id', passport.id)
      .eq('is_meaningful', true);

    const { data: scans } = await supabase
      .from('scan_events')
      .select('city')
      .eq('passport_id', passport.id)
      .eq('is_meaningful', true);

    const uniqueCities = new Set((scans ?? []).map((s) => s.city).filter(Boolean)).size;

    const brand = post?.brand ?? 'Unknown';
    const model = post?.model ?? 'Pair';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const ogParams = new URLSearchParams({
      qr: qrCode,
      brand,
      model,
      colorway: post?.colorway ?? '',
      cities: String(uniqueCities),
      scans: String(scanCount ?? 0),
      owners: '1',
      lot: post?.lot_id ?? '',
    });

    const ogImageUrl = `${baseUrl}/api/og/passport?${ogParams.toString()}`;
    const title = `${brand} ${model} · 16Store Passport`;
    const description = `${uniqueCities} thành phố · ${scanCount ?? 0} scans`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${baseUrl}/passport/${qrCode}`,
        siteName: '16Store',
        images: [{ url: ogImageUrl, width: 1200, height: 630 }],
        locale: 'vi_VN',
        type: 'website',
      },
      twitter: { card: 'summary_large_image', title, description, images: [ogImageUrl] },
    };
  } catch {
    return { title: '16Store Passport' };
  }
}

export default async function PassportPage({ params, searchParams }: PageProps) {
  const { qrCode } = await params;
  const sp = await searchParams;
  const defaultPanel = sp?.action ?? 'none';
  const supabase = createServiceClient();

  // Schema mới: 
  // - post_id (không phải current_post_id)
  // - owner_id (không phải current_owner_id)
  // - is_lost boolean (không phải status='lost')
  // - asset_metadata JSONB (không phải privacy_mode column)
  // - KHÔNG có total_scans/total_owners → COUNT
  const { data: passport } = await supabase
    .from('universal_assets')
    .select(`
      id, qr_code, is_lost,
      post_id, owner_id,
      brand, model, colorway,
      object_type, attributes,
      journey_score, journey_log,
      identity_status,
      first_claimant_id, first_claimed_at,
      claim_window_expires_at,
      security_tier,
      asset_metadata,
      cover_image_url,
      poster_url,
      created_at
    `)
    .eq('qr_code', qrCode)
    .single();

  if (!passport) notFound();

  // Privacy mode từ JSONB asset_metadata
  const privacyMode = (passport.asset_metadata as any)?.privacy_mode ?? 'public';

  // Check xem người đang xem có phải chủ nhân không
  // Dùng users_view để map auth_id → user_id đúng
  const authClient = await createClient();
  const { data: { user: currentUser } } = await authClient.auth.getUser();

  let isOwner = false;
  let currentProfileId: string | null = null;
  if (currentUser) {
    const { data: currentProfile } = await authClient
      .from('users_view')
      .select('id')
      .eq('auth_id', currentUser.id)
      .single();
    isOwner = currentProfile?.id === passport.owner_id;
    currentProfileId = currentProfile?.id ?? null;
  }

  // Post info
  const { data: post } = passport.post_id
    ? await supabase
        .from('posts_with_seller')
        .select('*')
        .eq('id', passport.post_id)
        .single()
    : { data: null };

  // Ownership history — join với users_view để lấy handle thật
  const { data: ownership } = await supabase
    .from('ownership_history')
    .select('*')
    .eq('passport_id', passport.id)
    .order('acquired_at', { ascending: false });

  // Journey map points — journal entries with GPS
  const { data: journeyPoints } = await supabase
    .from('passport_journal')
    .select('id, title, content, entry_date, lat, lng, entry_type, written_by_role, owner_id')
    .eq('passport_id', passport.id)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .order('entry_date', { ascending: true });

  // Active loan query
  const { data: activeLoan } = await supabase
    .from('asset_loans')
    .select('id, status, borrower_id, owner_id, due_at, weekly_hlr_rate')
    .eq('asset_id', passport.id)
    .in('status', ['pending', 'active', 'overdue'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const activeLoanId = activeLoan?.id ?? undefined;

  // Check if current user is borrower
  let isBorrowing = false;
  if (activeLoan?.borrower_id && currentProfileId) {
    isBorrowing = activeLoan.borrower_id === currentProfileId && activeLoan.status === 'active';
  }

  // Enrich ownership với handle thật từ users_view
  const enrichedOwnership = await Promise.all(
    (ownership ?? []).map(async (o) => {
      if (!o.owner_id) return { ...o, handle: o.owner_handle_snapshot ?? 'unknown', displayName: o.owner_display_name_snapshot ?? 'Unknown' };
      const { data: u } = await supabase
        .from('users_view')
        .select('handle, display_name')
        .eq('id', o.owner_id)
        .maybeSingle();
      return {
        ...o,
        handle: u?.handle ?? o.owner_handle_snapshot ?? 'unknown',
        displayName: u?.display_name ?? o.owner_display_name_snapshot ?? 'Unknown',
      };
    })
  );

  // Scan events
  const { data: scans } = await supabase
    .from('scan_events')
    .select('id, scan_type, city, country, location_lat, location_lng, location_accuracy_m, created_at')
    .eq('passport_id', passport.id)
    .eq('is_meaningful', true)
    .order('created_at', { ascending: false })
    .limit(50);

  // COUNT computed (schema mới không có total_scans/total_owners columns)
  const { count: totalScans } = await supabase
    .from('scan_events')
    .select('*', { count: 'exact', head: true })
    .eq('passport_id', passport.id)
    .eq('is_meaningful', true);

  const showLocations = privacyMode !== 'private';
  const ownerCount = ownership?.length ?? 0;
  const cityCount = new Set((scans ?? []).map((s) => s.city).filter(Boolean)).size;
  const isLost = passport.is_lost === true;
  const journeyScore = (passport as any).journey_score ?? 0;
  const journeyLog = ((passport as any).journey_log as any[]) ?? [];

  // ── Lấy brand/model từ nhiều nguồn ──────────────────────────
  // Priority: post → universal_assets columns → attributes JSONB
  const attrs = (passport as any).attributes as Record<string, any> ?? {};
  const displayBrand    = post?.brand    ?? (passport as any).brand    ?? attrs.brand    ?? 'Unknown';
  const displayModel    = post?.model    ?? (passport as any).model    ?? attrs.model    ?? 'Item';
  const displayColorway = post?.colorway ?? (passport as any).colorway ?? attrs.colorway ?? null;
  const displayLotId    = post?.lot_id   ?? (passport as any).qr_code  ?? null;
  const objectType      = (passport as any).object_type ?? 'sneaker';
  const objectLabel     = objectType === 'sneaker' ? 'HỘ CHIẾU GIÀY'
                        : objectType === 'watch'   ? 'HỘ CHIẾU ĐỒNG HỒ'
                        : objectType === 'bag'     ? 'HỘ CHIẾU TÚI XÁCH'
                        : objectType === 'art'     ? 'HỘ CHIẾU TÁC PHẨM'
                        : 'HỘ CHIẾU VẬT PHẨM';

  return (
    <>
      <Nav />
      <ScanRecorder passportId={passport.id} qrCode={qrCode} />
      <main className="max-w-[1200px] mx-auto px-8 py-10 max-md:px-5">

        {/* Lost banner */}
        {isLost && (
          <div className="mb-8 border-2 border-hazard bg-hazard/10 p-6">
            <div className="flex items-start gap-4">
              <div className="text-4xl">🚨</div>
              <div>
                <div className="font-mono text-[10px] text-hazard tracking-[0.22em] uppercase mb-2">
                  Vật phẩm này đang bị báo mất
                </div>
                <h2 className="font-display text-2xl uppercase mb-2">
                  Bạn vừa tìm thấy nó?
                </h2>
                <p className="font-body text-bone-2">
                  Chủ nhân đang tìm. Báo vị trí để nhận thưởng HLR.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-10 pb-6 border-b border-line">
          <div className="flex items-start justify-between gap-4 mb-3 max-md:flex-col">
            <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
              {objectLabel} · {qrCode}
            </div>
            <ShareButton
              qrCode={qrCode}
              brand={displayBrand}
              model={displayModel}
              cityCount={cityCount}
            />
          </div>
          <h1 className="font-display text-[clamp(36px,5vw,64px)] uppercase leading-[0.95] mb-3">
            {displayBrand}<br />
            <span className="text-rust">{displayModel}</span>
          </h1>
          {displayColorway && (
            <div className="font-serif italic text-2xl text-bone-2">
              &ldquo;{displayColorway}&rdquo;
            </div>
          )}
          <div className="mt-4 flex items-center gap-4 flex-wrap">
            <QRMiniDisplay qrCode={qrCode} passportId={isOwner ? passport.id : undefined} size={72} />
            <IDParticleBadge qrCode={qrCode} />
            {isOwner && (
              <IdentityPosterButton
                qrCode={qrCode}
                brand={displayBrand}
                model={displayModel}
                colorway={(passport as any).colorway ?? undefined}
                heroUrl={(passport as any).cover_image_url ?? undefined}
                ownerHandle={enrichedOwnership?.[0]?.handle ?? undefined}
                ownerCount={ownerCount}
                soulScore={journeyScore ?? undefined}
              />
              {isOwner && (
                <a
                  href="/identify"
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 9,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.5)',
                    background: 'transparent',
                    border: '0.5px solid rgba(255,255,255,0.15)',
                    borderRadius: 2,
                    padding: '4px 10px',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  + Định danh mới
                </a>
              )}
            )}
          </div>
        </div>

        {/* Poster — hiện nếu đã generate */}
        {(passport as any).poster_url && (
          <div className="mb-8">
            <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
              Poster định danh
            </div>
            <div className="relative max-w-[320px]">
              <img
                src={(passport as any).poster_url}
                alt={`${displayBrand} ${displayModel} poster`}
                className="w-full border border-line"
              />
              {isOwner && (
                <a
                  href={(passport as any).poster_url}
                  download={`16store-${qrCode}.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-2 right-2 font-mono text-[9px] bg-ink/80 text-rust border border-rust px-2 py-1 hover:bg-rust hover:text-ink transition-colors"
                >
                  ↓ Lưu poster
                </a>
              )}
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-0 border border-line mb-8 max-md:grid-cols-2 max-md:border-b-0">
          <BigStat label="Số chủ đã qua" value={ownerCount} />
          <BigStat label="Lượt scan" value={totalScans ?? 0} />
          <BigStat label="Thành phố" value={cityCount} highlight={cityCount >= 5} />
          <BigStat label="Trạng thái" value={isLost ? 'BỊ MẤT' : 'HOẠT ĐỘNG'} isText />
        </div>

        {/* Journey Score */}
        <section className="mb-10">
          <JourneyScore
            score={journeyScore}
            log={journeyLog}
            passportId={passport.id}
            isLost={isLost}
            lostMessage={null}
            objectType={objectType}
          />
        </section>

        {/* Identity Tier Badge */}
        <section className="mb-8">
          <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Danh phận · Xác thực
          </div>
          <IdentityTierBadge
            status={(passport as any).identity_status ?? 'unverified'}
            isOwner={isOwner}
            passportId={passport.id}
            qrCode={qrCode}
          />
        </section>

        {/* Owner Panel: Báo mất / Tìm thấy */}
        {isOwner && (
          <section className="mb-10">
            <LostFoundOwnerPanel
              passportId={passport.id}
              isLost={isLost}
              lostMessage={null}
              objectType={objectType}
            />
          </section>
        )}

        {/* Current pair info */}
        {post && (
          <section className="mb-10">
            <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase mb-4 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
              Thông tin hiện tại
            </div>
            <div className="grid grid-cols-3 gap-6 border border-line p-6 max-md:grid-cols-1">
              <SpecBlock label="Size" value={`${post.size_us} US`} />
              <SpecBlock label="Tình trạng" value={post.condition} />
              <SpecBlock label="Năm phát hành" value={String(post.release_year ?? '—')} />
              <SpecBlock label="Hub lưu trữ" value={(post as any).hub_name ?? '—'} />
              <SpecBlock label="Giá đề xuất" value={`${formatVnd(post.asking_price_vnd)} VNĐ`} />
              <SpecBlock
                label="Trạng thái"
                value={post.status === 'live' ? 'Đang bán' : post.status}
              />
            </div>
            <div className="mt-4 text-right">
              <Link
                href={`/lot/${post.lot_id}`}
                className="font-mono text-[11px] text-rust tracking-[0.2em] uppercase hover:text-bone transition-colors"
              >
                Xem trang chi tiết →
              </Link>
            </div>
          </section>
        )}

        {/* ── Owner Actions — nổi bật trước hành trình sở hữu ── */}
        {isOwner && (
          <section className="mb-10">
            <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
              Hành động nhanh
            </div>
            <PassportActions
              passportId={passport.id}
              qrCode={qrCode}
              assetId={passport.id}
              objectType={objectType}
              brand={displayBrand}
              model={displayModel}
              isOwner={isOwner}
              isLost={isLost}
              activeLoanId={activeLoanId}
              isBorrowing={isBorrowing}
              defaultPanel={defaultPanel as any}
              identityStatus={(passport as any).identity_status ?? 'unverified'}
              securityTier={(passport as any).security_tier ?? 'standard'}
            />
          </section>
        )}

        {/* Non-owner journal access */}
        {!isOwner && (
          <section className="mb-10">
            <PassportActions
              passportId={passport.id}
              qrCode={qrCode}
              assetId={passport.id}
              objectType={objectType}
              brand={displayBrand}
              model={displayModel}
              isOwner={false}
              isLost={isLost}
              identityStatus={(passport as any).identity_status ?? 'unverified'}
              securityTier={(passport as any).security_tier ?? 'standard'}
            />
          </section>
        )}

        {/* Ownership timeline */}
        {enrichedOwnership && enrichedOwnership.length > 0 && (
          <section className="mb-10">
            <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase mb-4 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
              Hành trình sở hữu · {enrichedOwnership.length} chủ
            </div>
            <div className="border border-line">
              {enrichedOwnership.map((o, idx) => (
                <div
                  key={o.id}
                  className={`p-5 ${idx < enrichedOwnership.length - 1 ? 'border-b border-line' : ''} ${!o.released_at ? 'bg-rust/5' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4 max-md:flex-col">
                    <div>
                      <div className="font-mono text-[10px] text-rust tracking-[0.18em] uppercase mb-1">
                        Chủ #{enrichedOwnership.length - idx} {!o.released_at && '· HIỆN TẠI'}
                      </div>
                      <div className="font-display text-lg uppercase mb-1">
                        {(o as any).displayName !== 'Unknown' ? (o as any).displayName : ((o as any).handle ? `@${(o as any).handle}` : 'Ẩn danh')}
                      </div>
                      <div className="font-mono text-[10px] text-rust/60 tracking-[0.14em] uppercase">
                        {(o as any).handle ? `@${(o as any).handle}` : ''}
                      </div>
                      <div className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase mt-1">
                        {o.acquisition_type?.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="font-mono text-[10px] text-bone-2 tracking-[0.14em] uppercase text-right max-md:text-left">
                      Từ {new Date(o.acquired_at).toLocaleDateString('vi-VN')}<br />
                      {o.released_at
                        ? `Đến ${new Date(o.released_at).toLocaleDateString('vi-VN')}`
                        : 'Đến nay'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Memory Map */}
        {scans && scans.length > 0 && showLocations && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
                Memory Map · Hành trình giày
              </div>
              <span className="font-mono text-[10px] text-rust tracking-[0.14em] uppercase">
                {cityCount} thành phố · {totalScans} scans ⚡ Interactive map
              </span>
            </div>
            <MemoryMap
              scans={scans}
              ownership={ownership ?? []}
              privacyMode={privacyMode}
              lotId={post?.lot_id ?? qrCode}
              journalPoints={(journeyPoints ?? []).map(p => ({
                id:          p.id,
                title:       p.title,
                content:     p.content,
                entry_date:  p.entry_date,
                entry_type:  p.entry_type,
                lat:         Number(p.lat),
                lng:         Number(p.lng),
              }))}
            />
          </section>
        )}

        {/* Social Card */}
        {post && (
          <section className="mb-10">
            <SocialCardGenerator
              passportId={passport.id}
              lotId={post.lot_id ?? qrCode}
              brand={post.brand ?? 'Unknown'}
              model={post.model ?? 'Pair'}
            />
          </section>
        )}

        {/* Passport Actions — Nhật ký, Cho mượn, Báo mất */}
        <PassportActions
          passportId={passport.id}
          qrCode={qrCode}
          assetId={passport.id}
          objectType={objectType}
          brand={displayBrand}
          model={displayModel}
          isOwner={isOwner}
          isLost={isLost}
          identityStatus={(passport as any).identity_status ?? 'unverified'}
          securityTier={(passport as any).security_tier ?? 'standard'}
        />

        {/* Verify badge */}
        <section className="mb-10 border border-rust bg-rust/5 p-6 text-center">
          <div className="font-mono text-[10px] text-rust tracking-[0.22em] uppercase mb-2">
            ✓ XÁC THỰC BỞI 16STORE
          </div>
          <div className="font-display text-xl uppercase mb-2">
            {objectType === 'sneaker' ? 'Đôi giày này' :
             objectType === 'watch'   ? 'Chiếc đồng hồ này' :
             objectType === 'bag'     ? 'Chiếc túi này' :
             objectType === 'art'     ? 'Tác phẩm này' :
             'Vật phẩm này'}{' '}
            có lịch sử{' '}
            <span className="font-serif italic font-normal text-rust normal-case">
              không thể giả mạo
            </span>
          </div>
          <p className="font-body text-sm text-bone-2">
            Mỗi scan QR được ghi vào blockchain DB của 16Store.
            Mỗi lần đổi chủ — được lưu vĩnh viễn.
          </p>
        </section>

        <div className="text-center pt-8 border-t border-line">
          <Link
            href="/"
            className="font-mono text-xs text-bone-2 tracking-[0.2em] uppercase hover:text-rust transition-colors"
          >
            ← Khám phá 16Store Floor
          </Link>
        </div>

      </main>
    </>
  );
}

function BigStat({
  label,
  value,
  highlight = false,
  isText = false,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  isText?: boolean;
}) {
  return (
    <div className={`p-6 border-r border-line last:border-r-0 max-md:border-b max-md:last:border-b-0 ${highlight ? 'bg-rust/5' : ''}`}>
      <div className="font-mono text-[10px] text-bone-2 tracking-[0.18em] uppercase mb-2">{label}</div>
      <div className={`font-display ${isText ? 'text-xl' : 'text-4xl'} ${highlight ? 'text-rust' : 'text-bone'}`}>
        {value}
      </div>
    </div>
  );
}

function SpecBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-concrete tracking-[0.18em] uppercase mb-1">{label}</div>
      <div className="font-display text-base text-bone">{value}</div>
    </div>
  );
}
