import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/Nav';
import { BuyerCheckout } from '@/components/BuyerCheckout';
import { formatVnd } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ lotId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lotId } = await params;
  const supabase   = createServiceClient();
  const { data }   = await supabase
    .from('posts')
    .select('brand, model, asking_price_vnd, cover_image_url')
    .eq('lot_id', lotId)
    .single();

  if (!data) return { title: '16Store Listing' };
  return {
    title: `${data.brand} ${data.model} · ${formatVnd(data.asking_price_vnd)} · 16Store`,
    openGraph: {
      images: data.cover_image_url ? [data.cover_image_url] : [],
    },
  };
}

export default async function ListingPage({ params }: PageProps) {
  const { lotId } = await params;
  const supabase  = createServiceClient();

  // Lấy post
  const { data: post } = await supabase
    .from('posts')
    .select(`
      id, lot_id, seller_id, hub_id,
      brand, model, colorway, size_us, condition,
      asking_price_vnd, description, status,
      image_urls, cover_image_url,
      listed_at, created_at,
      verify_stitching, verify_sole, verify_materials, verify_box,
      verified_at
    `)
    .eq('lot_id', lotId)
    .is('deleted_at', null)
    .single();

  if (!post) notFound();

  // Chỉ hiện listing đang live hoặc reserved
  if (!['live', 'reserved', 'sold'].includes(post.status)) notFound();

  // Lấy passport info từ universal_assets
  const { data: passport } = await supabase
    .from('universal_assets')
    .select('id, qr_code, identity_status, security_tier, journey_score, owner_id, poster_url')
    .eq('post_id', post.id)
    .maybeSingle();

  // Lấy seller info
  const { data: seller } = await supabase
    .from('users_view')
    .select('id, handle, display_name')
    .eq('id', post.seller_id)
    .maybeSingle();

  // Lấy hub info
  const { data: hub } = await supabase
    .from('hubs')
    .select('name, address, city')
    .eq('id', post.hub_id)
    .maybeSingle();

  // Check buyer đã login chưa
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  let buyerProfile = null;
  if (authUser) {
    const { data } = await authClient
      .from('users_view')
      .select('id, handle')
      .eq('auth_id', authUser.id)
      .single();
    buyerProfile = data;
  }

  const isSold     = post.status === 'sold';
  const isReserved = post.status === 'reserved';
  const isVerified = post.verify_stitching && post.verify_sole && post.verify_materials && post.verify_box;

  const images = [
    post.cover_image_url,
    ...(post.image_urls ?? []),
  ].filter(Boolean) as string[];

  return (
    <div style={{ background: '#080810', minHeight: '100vh', color: '#fff' }}>
      <Nav />

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 24px 60px' }}>

        {/* Breadcrumb */}
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 32, display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Floor</a>
          <span>›</span>
          <span style={{ color: '#C8531C' }}>{post.brand} {post.model}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 48, alignItems: 'start' }}>

          {/* LEFT — Images + Info */}
          <div>
            {/* Main image */}
            <div style={{
              aspectRatio: '1',
              background:  '#0d0d14',
              border:      '0.5px solid rgba(255,255,255,0.08)',
              marginBottom: 12,
              overflow:    'hidden',
              position:    'relative',
            }}>
              {images[0] ? (
                <img
                  src={images[0]}
                  alt={`${post.brand} ${post.model}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.15em' }}>
                    CHƯA CÓ ẢNH
                  </span>
                </div>
              )}

              {/* Status overlay */}
              {(isSold || isReserved) && (
                <div style={{
                  position:   'absolute', inset: 0,
                  background: isSold ? 'rgba(0,0,0,0.6)' : 'rgba(200,83,28,0.2)',
                  display:    'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    fontFamily:    'monospace', fontSize: 28, fontWeight: 700,
                    letterSpacing: '0.15em', textTransform: 'uppercase',
                    color:          isSold ? 'rgba(255,255,255,0.4)' : '#C8531C',
                    border:        `2px solid ${isSold ? 'rgba(255,255,255,0.2)' : '#C8531C'}`,
                    padding:       '8px 24px',
                    transform:     'rotate(-12deg)',
                  }}>
                    {isSold ? 'ĐÃ BÁN' : 'ĐẶT CỌC'}
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
                {images.slice(0, 5).map((img, i) => (
                  <div key={i} style={{
                    width: 72, height: 72, flexShrink: 0,
                    border: i === 0 ? '1px solid #C8531C' : '0.5px solid rgba(255,255,255,0.1)',
                    overflow: 'hidden',
                  }}>
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                ))}
              </div>
            )}

            {/* Item details */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#C8531C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, background: '#C8531C', display: 'inline-block' }} />
                Thông tin vật phẩm
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, border: '0.5px solid rgba(255,255,255,0.08)' }}>
                {[
                  { label: 'Tình trạng', value: post.condition ?? '—' },
                  { label: 'Size', value: post.size_us ? `${post.size_us} US` : '—' },
                  { label: 'Lot ID', value: post.lot_id },
                  { label: 'Niêm yết', value: post.listed_at ? new Date(post.listed_at).toLocaleDateString('vi-VN') : '—' },
                  ...(passport ? [
                    { label: 'Soul Score', value: `${passport.journey_score ?? 0} pts` },
                    { label: 'Xác thực', value: passport.identity_status === 'certified' ? '✦ 16Store' : passport.identity_status === 'ai_verified' ? '🤖 AI' : '🔓 Tự khai' },
                  ] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#fff' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            {post.description && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#C8531C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, background: '#C8531C', display: 'inline-block' }} />
                  Mô tả từ người bán
                </div>
                <p style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75 }}>
                  &ldquo;{post.description}&rdquo;
                </p>
              </div>
            )}

            {/* Verification badges */}
            {isVerified && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(110,192,112,0.08)', border: '0.5px solid rgba(110,192,112,0.3)', marginBottom: 32 }}>
                <span style={{ fontSize: 18 }}>✓</span>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#6ec070', fontWeight: 700, letterSpacing: '0.1em' }}>ĐÃ KIỂM ĐỊNH TẠI HUB</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                    {post.verified_at ? new Date(post.verified_at).toLocaleDateString('vi-VN') : ''} · {hub?.name}
                  </div>
                </div>
              </div>
            )}

            {/* Passport link */}
            {passport && (
              <a
                href={`/passport/${passport.qr_code}`}
                style={{
                  display:       'inline-flex',
                  alignItems:    'center',
                  gap:            8,
                  fontFamily:    'monospace',
                  fontSize:       10,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color:         'rgba(255,255,255,0.4)',
                  border:        '0.5px solid rgba(255,255,255,0.1)',
                  padding:       '8px 16px',
                  textDecoration:'none',
                  transition:    'all 0.2s',
                }}
              >
                ↗ Xem hộ chiếu vật phẩm · {passport.qr_code}
              </a>
            )}
          </div>

          {/* RIGHT — Checkout */}
          <div style={{ position: 'sticky', top: 100 }}>
            <BuyerCheckout
              post={{
                id:              post.id,
                lotId:           post.lot_id,
                brand:           post.brand,
                model:           post.model,
                colorway:        post.colorway,
                askingPriceVnd:  post.asking_price_vnd,
                status:          post.status,
                sellerId:        post.seller_id,
                passportId:      passport?.id ?? null,
              }}
              seller={seller}
              hub={hub}
              buyer={buyerProfile}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
