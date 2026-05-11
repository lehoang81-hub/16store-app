'use client';

import { useState } from 'react';

interface Post {
  id:             string;
  lotId:          string;
  brand:          string;
  model:          string;
  colorway?:      string | null;
  askingPriceVnd: number;
  status:         string;
  sellerId:       string;
  passportId:     string | null;
}

interface Props {
  post:   Post;
  seller: { id: string; handle: string; display_name?: string } | null;
  hub:    { name: string; address?: string; city?: string } | null;
  buyer:  { id: string; handle: string } | null;
}

const DEPOSIT_PCT = 0.3; // 30% đặt cọc

export function BuyerCheckout({ post, seller, hub, buyer }: Props) {
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [showWarn,  setShowWarn]  = useState(false);

  const depositAmt = Math.round(post.askingPriceVnd * DEPOSIT_PCT);
  const isSold     = post.status === 'sold';
  const isReserved = post.status === 'reserved';
  const canBuy     = post.status === 'live';

  const handleCheckout = () => {
    if (!buyer) {
      window.location.href = `/login?next=/listings/${post.lotId}`;
      return;
    }
    if (buyer.id === post.sellerId) {
      setError('Bạn không thể mua vật phẩm của chính mình');
      return;
    }
    setShowWarn(true);
  };

  const handleConfirm = async () => {
    setShowWarn(false);
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/orders/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          lotId:     post.lotId,
          sellerId:  post.sellerId,
          passportId: post.passportId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Không thể tạo đơn hàng');
      } else {
        // Redirect đến trang thanh toán VietQR
        window.location.href = `/orders/${data.orderId}/payment`;
      }
    } catch {
      setError('Lỗi kết nối, thử lại sau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background:  '#0d0d14',
      border:      '0.5px solid rgba(200,83,28,0.25)',
      padding:      28,
    }}>

      {/* Price */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>
          Giá niêm yết
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 36, fontWeight: 900, color: '#C8531C', lineHeight: 1 }}>
          {new Intl.NumberFormat('vi-VN').format(post.askingPriceVnd)}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>VNĐ</div>
      </div>

      {/* Deposit info */}
      {canBuy && (
        <div style={{
          padding:      '12px 14px',
          background:   'rgba(200,83,28,0.06)',
          border:       '0.5px solid rgba(200,83,28,0.2)',
          marginBottom:  20,
        }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#C8531C', letterSpacing: '0.1em', marginBottom: 4 }}>
            Đặt cọc 30%
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: '#fff' }}>
            {new Intl.NumberFormat('vi-VN').format(depositAmt)} VNĐ
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4, lineHeight: 1.6 }}>
            Thanh toán phần còn lại {new Intl.NumberFormat('vi-VN').format(post.askingPriceVnd - depositAmt)} VNĐ khi nhận hàng tại Hub
          </div>
        </div>
      )}

      {/* Hub info */}
      {hub && (
        <div style={{ marginBottom: 20, padding: '12px 0', borderTop: '0.5px solid rgba(255,255,255,0.06)', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            Hub nhận hàng
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#fff', marginBottom: 2 }}>{hub.name}</div>
          {hub.address && (
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{hub.address}</div>
          )}
        </div>
      )}

      {/* Seller info */}
      {seller && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            Người bán
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#fff' }}>
            @{seller.handle}
            {seller.display_name && (
              <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>{seller.display_name}</span>
            )}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 4, lineHeight: 1.6 }}>
            ⚠ Thông tin liên hệ người bán sẽ được cung cấp sau khi đặt cọc
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.4)', fontFamily: 'monospace', fontSize: 11, color: '#ef4444', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* CTA */}
      {isSold ? (
        <div style={{ textAlign: 'center', padding: '16px', fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', border: '0.5px solid rgba(255,255,255,0.08)' }}>
          ĐÃ BÁN
        </div>
      ) : isReserved ? (
        <div style={{ textAlign: 'center', padding: '16px', fontFamily: 'monospace', fontSize: 12, color: '#C8531C', letterSpacing: '0.12em', border: '0.5px solid rgba(200,83,28,0.3)' }}>
          ĐÃ CÓ NGƯỜI ĐẶT CỌC
        </div>
      ) : (
        <button
          onClick={handleCheckout}
          disabled={loading}
          style={{
            width:         '100%',
            padding:       '16px',
            background:    loading ? 'rgba(200,83,28,0.4)' : '#C8531C',
            color:         '#000',
            border:        'none',
            fontFamily:    'monospace',
            fontSize:       13,
            fontWeight:     700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            cursor:        loading ? 'not-allowed' : 'pointer',
            transition:    'all 0.2s',
          }}
        >
          {loading ? 'Đang xử lý...' : buyer ? `Đặt cọc ${new Intl.NumberFormat('vi-VN').format(depositAmt)} VNĐ` : 'Đăng nhập để mua'}
        </button>
      )}

      {/* No refund warning */}
      <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 12, lineHeight: 1.6, letterSpacing: '0.06em' }}>
        ⚠ Tiền cọc không được hoàn lại nếu huỷ giao dịch sau khi xác nhận
      </div>

      {/* Warning modal */}
      {showWarn && (
        <div onClick={() => setShowWarn(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d14', border: '1px solid rgba(200,83,28,0.4)', borderTop: '2px solid #C8531C', maxWidth: 420, width: '100%', padding: 28 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#C8531C', letterSpacing: '0.08em', marginBottom: 16 }}>
              ⚠ Xác nhận đặt cọc
            </div>
            <p style={{ fontFamily: 'Georgia,serif', fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 20 }}>
              Bạn sắp đặt cọc <strong style={{ color: '#fff' }}>{new Intl.NumberFormat('vi-VN').format(depositAmt)} VNĐ</strong> cho vật phẩm <strong style={{ color: '#fff' }}>{post.brand} {post.model}</strong>.
            </p>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.3)', padding: '10px 14px', marginBottom: 20 }}>
              <p style={{ fontFamily: 'monospace', fontSize: 10, color: '#ef4444', lineHeight: 1.6, margin: 0 }}>
                Tiền cọc KHÔNG được hoàn lại nếu bạn huỷ sau khi xác nhận thanh toán.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleConfirm}
                style={{ flex: 1, padding: '12px', background: '#C8531C', color: '#000', border: 'none', fontFamily: 'monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Xác nhận đặt cọc
              </button>
              <button
                onClick={() => setShowWarn(false)}
                style={{ padding: '12px 20px', background: 'transparent', color: 'rgba(255,255,255,0.4)', border: '0.5px solid rgba(255,255,255,0.1)', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
