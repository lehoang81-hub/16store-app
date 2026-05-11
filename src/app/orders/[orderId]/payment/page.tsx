import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/Nav';
import { PaymentTimer } from '@/components/PaymentTimer';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ orderId: string }>;
}

const BANK_BIN     = process.env.BANK_BIN     ?? '970422';
const BANK_ACCOUNT = process.env.BANK_ACCOUNT ?? '';
const BANK_NAME    = process.env.BANK_NAME    ?? '16STORE';

export default async function PaymentPage({ params }: PageProps) {
  const { orderId } = await params;
  const supabase    = createServiceClient();

  // Verify buyer
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  if (!authUser) {
    return (
      <div style={{ background: '#080810', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <a href="/login" style={{ fontFamily: 'monospace', color: '#C8531C' }}>Đăng nhập để xem</a>
      </div>
    );
  }

  const { data: buyer } = await supabase
    .from('users_view')
    .select('id, handle')
    .eq('auth_id', authUser.id)
    .single();

  // Lấy order
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (!order) notFound();
  if (order.buyer_id !== buyer?.id) notFound();

  // Lấy post info
  const { data: post } = await supabase
    .from('posts')
    .select('brand, model, colorway, cover_image_url')
    .eq('lot_id', order.lot_id)
    .single();

  // Build VietQR URL
  const amount      = order.deposit_vnd;
  const description = encodeURIComponent(order.vietqr_ref);
  const vietqrUrl   = `https://img.vietqr.io/image/${BANK_BIN}-${BANK_ACCOUNT}-compact2.png?amount=${amount}&addInfo=${description}&accountName=${encodeURIComponent(BANK_NAME)}`;

  const isPaid      = order.status === 'paid' || order.status === 'confirmed' || order.status === 'completed';
  const isCancelled = order.status === 'cancelled';
  const isExpired   = order.reserved_until && new Date(order.reserved_until) < new Date() && order.status === 'pending';

  return (
    <div style={{ background: '#080810', minHeight: '100vh', color: '#fff' }}>
      <Nav />

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '100px 24px 60px' }}>

        {/* Header */}
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#C8531C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, background: '#C8531C', display: 'inline-block' }} />
          Thanh toán đặt cọc
        </div>

        {/* Item summary */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 28, padding: '16px', background: '#0d0d14', border: '0.5px solid rgba(255,255,255,0.08)' }}>
          {post?.cover_image_url && (
            <img src={post.cover_image_url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', flexShrink: 0 }} />
          )}
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
              {post?.brand} {post?.model}
            </div>
            {post?.colorway && (
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>&ldquo;{post.colorway}&rdquo;</div>
            )}
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
              LOT {order.lot_id}
            </div>
          </div>
        </div>

        {isPaid ? (
          /* ── Đã thanh toán ── */
          <div style={{ textAlign: 'center', padding: '40px 20px', border: '0.5px solid rgba(110,192,112,0.3)', background: 'rgba(110,192,112,0.06)' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: '#6ec070', letterSpacing: '0.08em', marginBottom: 8 }}>
              ĐÃ THANH TOÁN
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
              Chúng tôi sẽ thông báo khi admin xác nhận đơn hàng
            </div>
            <a href={`/listings/${order.lot_id}`} style={{ fontFamily: 'monospace', fontSize: 10, color: '#C8531C', letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none', border: '0.5px solid rgba(200,83,28,0.4)', padding: '8px 20px' }}>
              ← Quay lại listing
            </a>
          </div>

        ) : isCancelled || isExpired ? (
          /* ── Hết hạn / Huỷ ── */
          <div style={{ textAlign: 'center', padding: '40px 20px', border: '0.5px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: '#ef4444', letterSpacing: '0.08em', marginBottom: 8 }}>
              {isCancelled ? 'ĐÃ HUỶ' : 'HẾT HẠN THANH TOÁN'}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
              Vật phẩm đã được mở lại để người khác mua
            </div>
            <a href={`/listings/${order.lot_id}`} style={{ fontFamily: 'monospace', fontSize: 10, color: '#C8531C', letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none', border: '0.5px solid rgba(200,83,28,0.4)', padding: '8px 20px' }}>
              Xem lại listing
            </a>
          </div>

        ) : (
          /* ── Chờ thanh toán ── */
          <>
            {/* Timer */}
            <PaymentTimer reservedUntil={order.reserved_until} orderId={orderId} />

            {/* Amount */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
                Số tiền cần chuyển
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 40, fontWeight: 900, color: '#C8531C', lineHeight: 1 }}>
                {new Intl.NumberFormat('vi-VN').format(order.deposit_vnd)}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>VNĐ</div>
            </div>

            {/* VietQR */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ display: 'inline-block', background: '#fff', padding: 16, borderRadius: 4 }}>
                <img
                  src={vietqrUrl}
                  alt="VietQR"
                  style={{ width: 240, height: 240, display: 'block' }}
                />
              </div>
            </div>

            {/* Transfer info */}
            <div style={{ background: '#0d0d14', border: '0.5px solid rgba(255,255,255,0.08)', padding: '16px 20px', marginBottom: 24 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
                Thông tin chuyển khoản
              </div>
              {[
                { label: 'Ngân hàng', value: BANK_NAME },
                { label: 'Số tài khoản', value: BANK_ACCOUNT },
                { label: 'Số tiền', value: `${new Intl.NumberFormat('vi-VN').format(order.deposit_vnd)} VNĐ` },
                { label: 'Nội dung', value: order.vietqr_ref },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, marginBottom: 8, borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>{label}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#fff', fontWeight: label === 'Nội dung' ? 700 : 400, color: label === 'Nội dung' ? '#C8531C' : '#fff' } as React.CSSProperties}>{value}</span>
                </div>
              ))}
            </div>

            {/* Important note */}
            <div style={{ background: 'rgba(200,83,28,0.06)', border: '0.5px solid rgba(200,83,28,0.2)', padding: '12px 16px', fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
              ⚠ Nhập <strong style={{ color: '#C8531C' }}>đúng nội dung</strong> khi chuyển khoản để hệ thống tự động xác nhận.<br />
              Sau khi chuyển, admin sẽ xác nhận trong vòng <strong style={{ color: '#fff' }}>2 giờ</strong>.
            </div>
          </>
        )}
      </main>
    </div>
  );
}
