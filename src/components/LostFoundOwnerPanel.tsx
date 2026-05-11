'use client'

import { useState } from 'react'
import { ActionBtn } from '@/components/ActionBtn'

interface Props {
  passportId: string
  isLost: boolean
  lostMessage: string | null
  objectType?: string
}

function getObjectMeta(objectType?: string) {
  const map: Record<string, {
    name: string; manage: string; manageSub: string;
    reportTitle: string; activeSub: string;
    foundBtn: string; placeholder: string;
  }> = {
    sneaker:  { name:'đôi giày',   manage:'Quản lý đôi giày',   manageSub:'Nếu bạn làm mất đôi giày, hãy bật báo mất để người nhặt được biết cách liên hệ.',   reportTitle:'🔍 Báo mất đôi giày',   activeSub:'Bất kỳ ai quét QR sẽ thấy thông báo và có thể liên hệ bạn.', foundBtn:'✓ Tìm thấy rồi — Tắt báo mất', placeholder:'VD: Tôi bị mất đôi giày ở Hồ Tây, Hà Nội. Liên hệ Telegram @username hoặc SĐT 0909...' },
    watch:    { name:'đồng hồ',    manage:'Quản lý đồng hồ',    manageSub:'Nếu bạn làm mất đồng hồ, hãy bật báo mất để người tìm được biết cách liên hệ.',     reportTitle:'🔍 Báo mất đồng hồ',    activeSub:'Bất kỳ ai quét QR sẽ thấy thông báo và có thể liên hệ bạn.', foundBtn:'✓ Tìm thấy rồi — Tắt báo mất', placeholder:'VD: Tôi bị mất đồng hồ tại sân bay Nội Bài. Liên hệ 0909...' },
    bag:      { name:'túi xách',   manage:'Quản lý túi xách',   manageSub:'Nếu bạn làm mất túi xách, hãy bật báo mất để người tìm được biết cách liên hệ.',     reportTitle:'🔍 Báo mất túi xách',   activeSub:'Bất kỳ ai quét QR sẽ thấy thông báo và có thể liên hệ bạn.', foundBtn:'✓ Tìm thấy rồi — Tắt báo mất', placeholder:'VD: Tôi bị mất túi tại TTTM X. Liên hệ 0909...' },
    art:      { name:'tác phẩm',   manage:'Quản lý tác phẩm',   manageSub:'Nếu tác phẩm bị thất lạc, hãy bật báo mất để người tìm được biết cách liên hệ.',     reportTitle:'🔍 Báo mất tác phẩm',   activeSub:'Bất kỳ ai quét QR sẽ thấy thông báo và có thể liên hệ bạn.', foundBtn:'✓ Tìm thấy rồi — Tắt báo mất', placeholder:'VD: Tác phẩm bị thất lạc sau triển lãm gallery X. Liên hệ 0909...' },
    ceramics: { name:'đồ gốm',     manage:'Quản lý đồ gốm',     manageSub:'Nếu bạn làm mất đồ gốm, hãy bật báo mất để người tìm được biết cách liên hệ.',       reportTitle:'🔍 Báo mất đồ gốm',     activeSub:'Bất kỳ ai quét QR sẽ thấy thông báo và có thể liên hệ bạn.', foundBtn:'✓ Tìm thấy rồi — Tắt báo mất', placeholder:'VD: Tôi bị mất đồ gốm khi vận chuyển. Liên hệ 0909...' },
  }
  return map[objectType ?? ''] ?? {
    name:'vật phẩm', manage:'Quản lý vật phẩm',
    manageSub:'Nếu bạn làm mất vật phẩm, hãy bật báo mất để người tìm được biết cách liên hệ.',
    reportTitle:'🔍 Báo mất vật phẩm',
    activeSub:'Bất kỳ ai quét QR vật phẩm sẽ thấy thông báo và có thể liên hệ bạn.',
    foundBtn:'✓ Tìm thấy rồi — Tắt báo mất',
    placeholder:'VD: Tôi bị mất vật phẩm tại... Liên hệ 0909...',
  }
}

const LOST_TIPS = [
  '📢 Đăng lên group mua bán / cộng đồng local với ảnh vật phẩm và QR code',
  '🗺️ Ghi lại lần cuối bạn nhìn thấy và địa điểm cụ thể',
  '📸 Chuẩn bị sẵn ảnh rõ nét để chia sẻ khi có người liên hệ',
  '🔔 Giữ Telegram hoạt động — bạn nhận thông báo ngay khi ai scan QR',
  '⏰ Báo mất trong 24h đầu giúp tăng cơ hội tìm lại lên đáng kể',
]

export function LostFoundOwnerPanel({ passportId, isLost: initLost, lostMessage: initMsg, objectType }: Props) {
  const [isLost,      setIsLost]      = useState(initLost)
  const [message,     setMessage]     = useState(initMsg ?? '')
  const [showForm,    setShowForm]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [done,        setDone]        = useState(false)
  const [activatedAt,  setActivatedAt]  = useState<string | null>(null)
  const [lostError,    setLostError]    = useState<string | null>(null)
  const [hlrDeducted,  setHlrDeducted]  = useState(0)
  const meta = getObjectMeta(objectType)

  async function handleReportLost() {
    setLoading(true)
    setLostError(null)
    try {
      const res = await fetch('/api/passports/lost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passport_id: passportId, message }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLostError(data.error ?? 'Lỗi không xác định')
        return
      }
      setIsLost(true)
      setShowForm(false)
      setDone(true)
      setHlrDeducted(data.hlrDeducted ?? 10)
      setActivatedAt(data.activatedAt ?? new Date().toLocaleString('vi-VN'))
    } catch (err) {
      setLostError('Lỗi kết nối. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  async function handleFoundAgain() {
    setLoading(true)
    try {
      await fetch('/api/passports/found', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passport_id: passportId }),
      })
      setIsLost(false); setDone(false); setActivatedAt(null); setMessage('')
    } finally {
      setLoading(false)
    }
  }

  if (!isLost && !showForm) {
    return (
      <div className="border border-line p-4 flex items-center justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-concrete mb-1">{meta.manage}</div>
          <p className="font-mono text-[11px] text-bone-2">{meta.manageSub}</p>
        </div>
        <div className="flex-shrink-0">
          <ActionBtn icon="🔍" label="Báo mất" danger onClick={() => setShowForm(true)} />
        </div>
      </div>
    )
  }

  if (showForm) {
    return (
      <div className="border border-rust bg-rust/5 p-5 space-y-4">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-rust">{meta.reportTitle}</div>
        <p className="font-mono text-[11px] text-bone-2 leading-relaxed">
          Sau khi bật, bất kỳ ai quét QR {meta.name} này sẽ thấy thông báo và hướng dẫn liên hệ bạn.
        </p>
        <div>
          <label className="font-mono text-[10px] tracking-[0.14em] uppercase text-concrete block mb-2">
            Tin nhắn cho người tìm thấy (tuỳ chọn)
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={meta.placeholder}
            rows={3} maxLength={300}
            className="w-full bg-ink border border-line text-bone text-sm p-3 font-mono resize-none focus:outline-none focus:border-rust"
          />
          <div className="font-mono text-[9px] text-concrete text-right mt-1">{message.length}/300</div>
        </div>
        {lostError && (
          <div className="font-mono text-[10px] text-rust border border-rust/30 bg-rust/5 p-2">
            {lostError}
          </div>
        )}
        <div className="font-mono text-[9px] text-concrete">
          ⚠️ Kích hoạt sẽ trừ <span className="text-rust font-bold">10 HLR</span> (không hoàn lại). Hãy chắc chắn trước khi bật.
        </div>
        <div className="flex gap-3">
          <ActionBtn icon="✕" label="Huỷ" onClick={() => { setShowForm(false); setLostError(null); }} disabled={loading} />
          <div style={{ flex: 1 }}>
            <ActionBtn
              icon="🔍" label={loading ? 'Đang xử lý...' : 'Bật báo mất · 10 HLR →'}
              loading={loading} danger fullWidth onClick={handleReportLost}
            />
          </div>
        </div>
      </div>
    )
  }

  // Active lost
  return (
    <div className="border-2 border-rust bg-rust/5 p-5 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-block w-2 h-2 rounded-full bg-rust animate-pulse" />
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-rust">Đang báo mất · Hoạt động</span>
        {activatedAt && (
          <span className="font-mono text-[9px] text-concrete ml-auto">Kích hoạt: {activatedAt}</span>
        )}
      </div>

      <p className="font-mono text-[11px] text-bone-2">{meta.activeSub}</p>

      {message && (
        <p className="font-mono text-[11px] text-bone italic border-l-2 border-rust/40 pl-3">
          &ldquo;{message}&rdquo;
        </p>
      )}

      {/* Telegram confirm */}
      {done && (
        <div className="border border-[#6ec070]/30 bg-[#6ec070]/5 p-3 space-y-2">
          <div className="font-mono text-[10px] text-[#6ec070] font-bold tracking-[0.12em] uppercase">
            ✓ Đã gửi thông báo Telegram · -{hlrDeducted} HLR (không hoàn lại)
          </div>
          <div className="font-mono text-[10px] text-concrete leading-[1.6]">
            Bạn sẽ nhận Telegram ngay khi có người quét QR.
            Thời điểm kích hoạt: <span className="text-bone">{activatedAt}</span>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="border border-line/40 bg-line/5 p-3 space-y-2 rounded-sm">
        <div className="font-mono text-[9px] text-rust tracking-[0.15em] uppercase mb-2">
          💡 Việc cần làm để tăng cơ hội tìm lại
        </div>
        {LOST_TIPS.map((tip, i) => (
          <div key={i} className="font-mono text-[10px] text-bone-2 leading-[1.7]">{tip}</div>
        ))}
      </div>

      <ActionBtn
        icon="✓"
        label={loading ? 'Đang xử lý...' : meta.foundBtn}
        loading={loading}
        fullWidth
        accentColor="#6ec070"
        onClick={handleFoundAgain}
      />
    </div>
  )
}
