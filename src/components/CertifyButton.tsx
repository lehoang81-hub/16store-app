'use client';

import { useState, useEffect } from 'react';

interface Props {
  passportId: string;
  qrCode:     string;
}

type RequestStatus = 'none' | 'pending' | 'approved' | 'rejected';

interface CertRequest {
  id:            string;
  status:        RequestStatus;
  requested_at:  string;
  reviewed_at?:  string;
  reject_reason?: string;
}

export function CertifyButton({ passportId, qrCode }: Props) {
  const [open,        setOpen]        = useState(false);
  const [notes,       setNotes]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [checking,    setChecking]    = useState(true);
  const [request,     setRequest]     = useState<CertRequest | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [submitted,   setSubmitted]   = useState(false);

  // Check existing request on mount
  useEffect(() => {
    fetch(`/api/certify/request?passportId=${passportId}`)
      .then(r => r.json())
      .then(d => { setRequest(d.request); setChecking(false); })
      .catch(() => setChecking(false));
  }, [passportId]);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/certify/request', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ passportId, notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Không thể gửi yêu cầu');
      } else {
        setSubmitted(true);
        setRequest({ id: data.requestId, status: 'pending', requested_at: new Date().toISOString() });
        setTimeout(() => setOpen(false), 2000);
      }
    } catch {
      setError('Lỗi kết nối, thử lại sau');
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

  // ── Trạng thái đã có request ──────────────────────────────
  const statusUI = () => {
    if (!request) return null;

    if (request.status === 'pending') return (
      <div style={statusBox('#C8531C')}>
        <span style={{ fontSize: 14 }}>⏳</span>
        <div>
          <div style={statusTitle('#C8531C')}>Đang chờ xét duyệt</div>
          <div style={statusSub}>Gửi lúc {new Date(request.requested_at).toLocaleDateString('vi-VN')} · Admin sẽ liên hệ qua Telegram</div>
        </div>
      </div>
    );

    if (request.status === 'rejected') return (
      <div style={statusBox('#ef4444')}>
        <span style={{ fontSize: 14 }}>✗</span>
        <div style={{ flex: 1 }}>
          <div style={statusTitle('#ef4444')}>Yêu cầu bị từ chối</div>
          {request.reject_reason && (
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
              Lý do: {request.reject_reason}
            </div>
          )}
          <button
            onClick={() => { setRequest(null); setOpen(true); }}
            style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 10, color: '#C8531C', background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Gửi lại yêu cầu →
          </button>
        </div>
      </div>
    );

    return null;
  };

  return (
    <>
      {/* Status nếu đang pending/rejected */}
      {statusUI()}

      {/* Button — chỉ hiện nếu chưa có request pending */}
      {(!request || request.status === 'rejected') && !open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            marginTop:     request?.status === 'rejected' ? 0 : 14,
            width:         '100%',
            padding:       '12px 20px',
            fontFamily:    'monospace',
            fontSize:       12,
            fontWeight:     600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            background:    'transparent',
            border:        '0.5px solid #d4af3760',
            color:         '#d4af37',
            cursor:        'pointer',
            display:       'flex',
            alignItems:    'center',
            justifyContent:'center',
            gap:            8,
            transition:    'all 0.2s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(212,175,55,0.1)';
            (e.currentTarget as HTMLElement).style.borderColor = '#d4af37';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.borderColor = '#d4af3760';
          }}
        >
          <span>✦</span>
          Yêu cầu chứng nhận 16Store
        </button>
      )}

      {/* Modal */}
      {open && (
        <div
          onClick={() => !loading && setOpen(false)}
          style={{
            position:   'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.8)',
            display:    'flex', alignItems: 'center', justifyContent: 'center',
            padding:    24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:  '#0d0d14',
              border:      '1px solid #d4af3740',
              borderTop:   '2px solid #d4af37',
              maxWidth:     440,
              width:       '100%',
              padding:      28,
              position:    'relative',
            }}
          >
            <button
              onClick={() => setOpen(false)}
              style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18 }}
            >✕</button>

            {submitted ? (
              // Success state
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>✦</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, color: '#d4af37', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>
                  Đã gửi yêu cầu!
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  Admin sẽ xem xét và phản hồi qua Telegram
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 22, filter: 'drop-shadow(0 0 8px #d4af37)' }}>✦</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: '#d4af37', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Yêu cầu chứng nhận
                    </span>
                  </div>
                  <p style={{ fontFamily: 'Georgia,serif', fontSize: 13, fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, margin: 0 }}>
                    Sau khi gửi, admin 16Store sẽ kiểm tra và xác nhận. Bạn có thể cần mang vật phẩm đến Hub gần nhất để xác thực vật lý.
                  </p>
                </div>

                {/* Checklist */}
                <div style={{ marginBottom: 20, padding: '14px 16px', background: 'rgba(212,175,55,0.06)', border: '0.5px solid rgba(212,175,55,0.2)' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#d4af3780', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Chuẩn bị trước khi gửi
                  </div>
                  {[
                    'Ảnh định danh rõ nét, đúng góc',
                    'Thông tin brand/model chính xác',
                    'Sẵn sàng mang đến Hub nếu được yêu cầu',
                    'Telegram đã kết nối để nhận thông báo',
                  ].map(item => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ color: '#d4af37', fontSize: 10 }}>✓</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{item}</span>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    Ghi chú cho admin (tuỳ chọn)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="VD: Đây là đôi giày tôi mua trực tiếp tại store, có bill gốc..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    style={{
                      width:       '100%',
                      background:  'rgba(255,255,255,0.04)',
                      border:      '0.5px solid rgba(255,255,255,0.12)',
                      color:       'rgba(255,255,255,0.8)',
                      fontFamily:  'monospace',
                      fontSize:     12,
                      padding:     '10px 12px',
                      resize:      'none',
                      outline:     'none',
                      boxSizing:   'border-box',
                    }}
                    maxLength={500}
                  />
                  <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'right', marginTop: 4 }}>
                    {notes.length}/500
                  </div>
                </div>

                {error && (
                  <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '0.5px solid rgba(239,68,68,0.4)', fontFamily: 'monospace', fontSize: 11, color: '#ef4444' }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    width:         '100%',
                    padding:       '14px',
                    background:    loading ? 'rgba(212,175,55,0.3)' : '#d4af37',
                    color:         loading ? 'rgba(255,255,255,0.5)' : '#0a0a0f',
                    border:        'none',
                    fontFamily:    'monospace',
                    fontSize:       13,
                    fontWeight:     700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    cursor:        loading ? 'not-allowed' : 'pointer',
                    transition:    'all 0.2s',
                  }}
                >
                  {loading ? 'Đang gửi...' : '✦ Gửi yêu cầu chứng nhận'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Style helpers ─────────────────────────────────────────────
const statusBox = (color: string): React.CSSProperties => ({
  display:    'flex',
  alignItems: 'flex-start',
  gap:         10,
  padding:    '12px 14px',
  background: `${color}10`,
  border:     `0.5px solid ${color}40`,
  marginTop:   14,
  fontFamily: 'monospace',
  fontSize:    12,
  color,
});

const statusTitle = (color: string): React.CSSProperties => ({
  fontFamily:    'monospace',
  fontSize:       12,
  fontWeight:     600,
  color,
  letterSpacing: '0.08em',
});

const statusSub: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize:    10,
  color:      'rgba(255,255,255,0.35)',
  marginTop:   3,
  letterSpacing: '0.06em',
};
