'use client'

import { useState } from 'react'

interface JourneyEntry {
  points: number
  reason: string
  metadata: Record<string, string>
  timestamp: string
  score_after: number
}

interface JourneyScoreProps {
  score: number
  log: JourneyEntry[]
  passportId: string
  isLost?: boolean
  lostMessage?: string | null
  objectType?: string
}

const REASON_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  born:        { label: 'Khai sinh',       icon: '✦', color: 'text-hazard' },
  qr_scan:     { label: 'Được khám phá',   icon: '📍', color: 'text-[#6ec070]' },
  new_owner:   { label: 'Chủ mới',         icon: '🤝', color: 'text-rust' },
  verified:    { label: 'Xác thực hub',    icon: '✓',  color: 'text-rust' },
  social_card: { label: 'Social Card',     icon: '🎨', color: 'text-bone-2' },
  hotspot:     { label: 'Phân tích AI',    icon: '🔬', color: 'text-bone-2' },
  review:      { label: 'Được yêu thích',  icon: '⭐', color: 'text-hazard' },
}

// ── Dynamic text per object_type ─────────────────────────────
const OBJECT_META: Record<string, {
  name: string; found: string; lost: string;
  placeholder: string; manage: string; manageSub: string;
}> = {
  sneaker: {
    name: 'đôi giày',
    found: '🔍 Nhặt được đôi giày này?',
    lost: '🔍 Đôi giày đang thất lạc',
    placeholder: 'VD: Tôi nhặt được đôi giày tại Hà Nội, liên hệ 09...',
    manage: 'Quản lý đôi giày',
    manageSub: 'Nếu bạn làm mất đôi giày, hãy bật báo mất để người nhặt được biết cách liên hệ.',
  },
  watch: {
    name: 'đồng hồ',
    found: '🔍 Tìm thấy chiếc đồng hồ này?',
    lost: '🔍 Đồng hồ đang thất lạc',
    placeholder: 'VD: Tôi tìm thấy đồng hồ tại HCM, liên hệ 09...',
    manage: 'Quản lý đồng hồ',
    manageSub: 'Nếu bạn làm mất đồng hồ, hãy bật báo mất để người tìm được biết cách liên hệ.',
  },
  bag: {
    name: 'chiếc túi',
    found: '🔍 Tìm thấy chiếc túi này?',
    lost: '🔍 Chiếc túi đang thất lạc',
    placeholder: 'VD: Tôi nhặt được túi tại Đà Nẵng, liên hệ 09...',
    manage: 'Quản lý túi xách',
    manageSub: 'Nếu bạn làm mất túi xách, hãy bật báo mất để người tìm được biết cách liên hệ.',
  },
  art: {
    name: 'tác phẩm',
    found: '🔍 Tìm thấy tác phẩm này?',
    lost: '🔍 Tác phẩm đang thất lạc',
    placeholder: 'VD: Tôi tìm thấy tác phẩm tại gallery X, liên hệ 09...',
    manage: 'Quản lý tác phẩm',
    manageSub: 'Nếu tác phẩm bị thất lạc, hãy bật báo mất để người tìm được biết cách liên hệ.',
  },
  ceramics: {
    name: 'đồ gốm',
    found: '🔍 Tìm thấy đồ gốm này?',
    lost: '🔍 Đồ gốm đang thất lạc',
    placeholder: 'VD: Tôi tìm thấy đồ gốm tại Bát Tràng, liên hệ 09...',
    manage: 'Quản lý đồ gốm',
    manageSub: 'Nếu bạn làm mất đồ gốm, hãy bật báo mất để người tìm được biết cách liên hệ.',
  },
}

const DEFAULT_META = {
  name: 'vật phẩm',
  found: '🔍 Tìm thấy vật phẩm này?',
  lost: '🔍 Vật phẩm đang thất lạc',
  placeholder: 'VD: Tôi tìm thấy vật phẩm này tại..., liên hệ 09...',
  manage: 'Quản lý vật phẩm',
  manageSub: 'Nếu bạn làm mất vật phẩm, hãy bật báo mất để người tìm được biết cách liên hệ.',
}

// ── Soul Score tiers ──────────────────────────────────────────
const SOUL_TIERS = [
  {
    min: 0, max: 149,
    label: 'Born', labelVi: 'Khai sinh',
    color: 'bg-concrete', hex: '#888',
    desc: 'Vật phẩm vừa được định danh. Hành trình đang bắt đầu.',
  },
  {
    min: 150, max: 299,
    label: 'Traveled', labelVi: 'Lữ hành',
    color: 'bg-[#6ec070]', hex: '#6ec070',
    desc: 'Đã đi qua nhiều thành phố, được nhiều người scan và khám phá.',
  },
  {
    min: 300, max: 499,
    label: 'Legend', labelVi: 'Huyền thoại',
    color: 'bg-hazard', hex: '#d4af37',
    desc: 'Vật phẩm có lịch sử phong phú, nhiều chủ sở hữu và kỷ niệm.',
  },
  {
    min: 500, max: 9999,
    label: 'Icon', labelVi: 'Biểu tượng',
    color: 'bg-rust', hex: '#c8531c',
    desc: 'Di sản đích thực. Vật phẩm này là một phần của lịch sử cộng đồng.',
  },
]

const SCORE_GUIDE = [
  { icon: '✦', label: 'Khai sinh',     pts: '+50', desc: 'Định danh vật phẩm lần đầu' },
  { icon: '📍', label: 'Scan QR',      pts: '+10', desc: 'Mỗi lần có người scan' },
  { icon: '🌆', label: 'Thành phố mới',pts: '+15', desc: 'Scan tại địa điểm mới' },
  { icon: '🤝', label: 'Đổi chủ',      pts: '+30', desc: 'Chuyển nhượng thành công' },
  { icon: '✓',  label: 'Xác thực hub', pts: '+20', desc: 'Hub kiểm định vật phẩm' },
  { icon: '📝', label: 'Nhật ký',      pts: '+5',  desc: 'Mỗi entry nhật ký thêm vào' },
  { icon: '⭐', label: 'Được yêu thích',pts: '+8', desc: 'Được cộng đồng yêu thích' },
]

// ── ScoreBar ──────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const [showGuide, setShowGuide] = useState(false)
  const tier = SOUL_TIERS.find(m => score >= m.min && score <= m.max) ?? SOUL_TIERS[0]
  const nextTier = SOUL_TIERS[SOUL_TIERS.indexOf(tier) + 1]
  const progress = nextTier
    ? Math.min(100, ((score - tier.min) / (nextTier.min - tier.min)) * 100)
    : 100

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase font-bold"
            style={{ color: tier.hex }}>
            {tier.label}
          </span>
          <span className="font-mono text-[9px] text-concrete">· {tier.labelVi}</span>
        </div>
        {nextTier && (
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-bone-2">
            → {nextTier.label} ({nextTier.min - score} điểm nữa)
          </span>
        )}
      </div>
      <div className="h-1 bg-line w-full">
        <div
          className={`h-full ${tier.color} transition-all duration-700`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="font-mono text-[9px] text-concrete italic">{tier.desc}</div>

      {/* Guide toggle */}
      <button
        onClick={() => setShowGuide(v => !v)}
        className="font-mono text-[9px] text-concrete tracking-[0.1em] hover:text-rust transition-colors"
      >
        {showGuide ? '▲ Ẩn hướng dẫn' : '▼ Cách tăng Soul Score'}
      </button>

      {showGuide && (
        <div className="border border-line p-3 space-y-2">
          <div className="font-mono text-[9px] text-rust tracking-[0.12em] uppercase mb-2">
            Soul Score — Linh hồn của vật phẩm
          </div>
          <p className="font-mono text-[9px] text-concrete leading-[1.6] mb-3">
            Soul Score đo lường hành trình và lịch sử của vật phẩm. Điểm càng cao, vật phẩm càng có giá trị di sản và được tin tưởng hơn trên sàn 16Store.
          </p>
          {SCORE_GUIDE.map((g, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-5 text-center" style={{ fontSize: 12 }}>{g.icon}</span>
              <span className="font-mono text-[10px] text-bone-2 flex-1">{g.label}</span>
              <span className="font-mono text-[9px] text-concrete">{g.desc}</span>
              <span className="font-mono text-[10px] text-[#6ec070] font-bold min-w-[36px] text-right">{g.pts}</span>
            </div>
          ))}
          <div className="border-t border-line pt-2 mt-1">
            <div className="font-mono text-[9px] text-concrete italic">
              Các cột mốc: Born (0) → Traveled (150) → Legend (300) → Icon (500)
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export function JourneyScore({
  score, log, passportId, isLost, lostMessage, objectType,
}: JourneyScoreProps) {
  const [showLog, setShowLog]             = useState(false)
  const [reportingLost, setReportingLost] = useState(false)
  const [lostMsg, setLostMsg]             = useState('')
  const [lostLoading, setLostLoading]     = useState(false)
  const [lostDone, setLostDone]           = useState(false)

  const meta = OBJECT_META[objectType ?? ''] ?? DEFAULT_META
  const recentLog = [...log].reverse().slice(0, 8)

  async function handleReportLost() {
    setLostLoading(true)
    try {
      await fetch('/api/passports/lost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passport_id: passportId, message: lostMsg }),
      })
      setLostDone(true)
      setReportingLost(false)
    } finally {
      setLostLoading(false)
    }
  }

  return (
    <div className="border border-line p-5 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-rust flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
          Soul Score
        </div>
        <div className="font-['Space_Mono'] text-2xl text-bone">
          {score} <span className="font-mono text-[10px] text-concrete">pts</span>
        </div>
      </div>

      {/* Score bar + guide */}
      <ScoreBar score={score} />

      {/* Lost & Found — dynamic text */}
      {isLost ? (
        <div className="border border-rust bg-rust/5 p-3">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-rust mb-1">
            {meta.lost}
          </div>
          {lostMessage && (
            <p className="font-mono text-[11px] text-bone-2">{lostMessage}</p>
          )}
        </div>
      ) : lostDone ? (
        <div className="border border-[#6ec070]/30 bg-[#6ec070]/5 p-3">
          <p className="font-mono text-[11px] text-[#6ec070]">
            ✓ Đã báo thất lạc. Chủ nhân sẽ được thông báo.
          </p>
        </div>
      ) : reportingLost ? (
        <div className="border border-line p-3 space-y-2">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-concrete">
            Nhắn tin cho chủ nhân (ẩn danh)
          </p>
          <textarea
            value={lostMsg}
            onChange={(e) => setLostMsg(e.target.value)}
            placeholder={meta.placeholder}
            rows={3}
            className="w-full bg-ink border border-line text-bone text-sm p-2 font-mono resize-none focus:outline-none focus:border-bone-2"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setReportingLost(false)}
              className="flex-1 border border-line text-concrete py-2 font-mono text-[10px] tracking-[0.14em] uppercase hover:text-bone transition-colors"
            >
              Huỷ
            </button>
            <button
              onClick={handleReportLost}
              disabled={!lostMsg.trim() || lostLoading}
              className="flex-1 bg-rust text-ink py-2 font-mono text-[10px] font-bold tracking-[0.14em] uppercase hover:bg-bone transition-colors disabled:opacity-40"
            >
              {lostLoading ? 'Đang gửi...' : 'Gửi →'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setReportingLost(true)}
          className="w-full border border-dashed border-line text-bone-2 py-2 font-mono text-[10px] tracking-[0.14em] uppercase hover:border-rust hover:text-rust transition-colors"
        >
          {meta.found}
        </button>
      )}

      {/* Journey log toggle */}
      <button
        onClick={() => setShowLog(!showLog)}
        className="w-full flex items-center justify-between font-mono text-[10px] tracking-[0.14em] uppercase text-bone-2 hover:text-bone transition-colors"
      >
        <span>Lịch sử hành trình · {log.length} sự kiện</span>
        <span>{showLog ? '▲' : '▼'}</span>
      </button>

      {showLog && (
        <div className="space-y-2 border-t border-line pt-3">
          {recentLog.length === 0 ? (
            <div className="font-mono text-[10px] text-concrete text-center py-4">
              Chưa có sự kiện nào
            </div>
          ) : (
            recentLog.map((entry, i) => {
              const cfg = REASON_LABELS[entry.reason] ?? {
                label: entry.reason, icon: '·', color: 'text-concrete'
              }
              return (
                <div key={i} className="flex items-start gap-3">
                  <span className={`font-mono text-sm ${cfg.color} flex-shrink-0`}>{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-[10px] tracking-[0.14em] uppercase ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="font-mono text-[10px] text-concrete">
                        +{entry.points} pts
                      </span>
                    </div>
                    <span className="font-mono text-[9px] text-concrete">
                      {new Date(entry.timestamp).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
