import { getPlatformStats } from '@/lib/queries/posts';

export async function Hero() {
  const stats = await getPlatformStats();

  return (
    <section className="relative border-b border-line overflow-hidden min-h-[88vh] flex items-stretch">
      <div className="grid grid-cols-[1.1fr_1fr] w-full max-lg:grid-cols-1">
        {/* LEFT */}
        <div className="px-8 py-15 pb-10 flex flex-col justify-between border-r border-line relative max-md:px-5 max-md:py-10">
          <div>
            <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-concrete flex items-center gap-3 before:content-[''] before:w-8 before:h-px before:bg-rust">
              Đợt drop / 16 · Tuần 47 · 2026
            </div>
            <h1 className="font-display text-[clamp(56px,8vw,124px)] leading-[0.88] tracking-[-0.04em] my-7 uppercase">
              Đôi giày<br />
              <span className="font-serif italic font-normal text-rust normal-case tracking-[-0.02em]">không chỉ</span><br />
              là đôi giày.
            </h1>
            <p className="text-base leading-[1.55] text-bone-2 max-w-[460px] font-light">
              16Store là sàn ký gửi sneaker được xác thực — nơi từng đôi đi qua bốn lớp kiểm định, được catalog hoá theo chỉ số riêng, và đến tay người chơi qua hệ thống hub vật lý trên toàn quốc. Không scam. Không fake. Không lặng tiếng.
            </p>
          </div>

          <div>
            <div className="grid grid-cols-4 gap-0 mt-12 border-t border-line pt-6 max-sm:grid-cols-2 max-sm:gap-y-5">
              <Stat num={stats.totalVerified.toLocaleString()} label="Pairs verified" />
              <Stat num={String(stats.activeHubs).padStart(2, '0')} label="Active hubs" />
              <Stat num={`${stats.avgPayoutHours}H`} label="Avg. payout" last />
              <Stat num={`+${stats.indexChange}%`} label="Index 7D" last />
            </div>
            <div className="flex gap-3 mt-8 items-center max-sm:flex-wrap">
              <button className="bg-rust text-ink px-5 py-[11px] font-mono text-[11px] font-bold tracking-[0.16em] uppercase inline-flex items-center gap-2 hover:bg-bone transition-colors group">
                Browse the floor
                <span className="group-hover:translate-x-[3px] transition-transform">→</span>
              </button>
              <button className="bg-transparent text-bone border border-line-strong px-5 py-[11px] font-mono text-[11px] font-bold tracking-[0.16em] uppercase hover:border-bone transition-colors">
                How it works
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — feature shoe */}
        <div className="relative flex items-center justify-center overflow-hidden bg-ink-2 max-lg:min-h-[520px]"
          style={{ background: 'radial-gradient(circle at 50% 60%, rgba(200,83,28,0.18), transparent 65%), var(--color-ink-2)' }}>
          {/* blueprint grid */}
          <div className="absolute inset-0 bg-blueprint opacity-50" />

          {/* corner stamp */}
          <div className="absolute top-6 right-6 w-[92px] h-[92px] border border-rust rounded-full flex flex-col items-center justify-center font-mono text-[9px] tracking-[0.18em] uppercase text-rust text-center leading-[1.4] animate-spin-slow z-[4]">
            <div>est</div>
            <div className="font-serif text-[22px] italic text-bone tracking-normal normal-case my-1">2024</div>
            <div>hà nội · vn</div>
          </div>

          <div className="relative w-[80%] aspect-square flex items-center justify-center">
            <IdxTag className="top-[18%] left-[8%]">LOT // A-481<br />JORDAN 4</IdxTag>
            <IdxTag className="top-[38%] right-[8%] text-right [&::before]:ml-auto">SIZE // 9.5 US<br />VERIFIED ✓</IdxTag>
            <IdxTag className="bottom-[22%] left-[12%]">VNĐ // 6,800,000<br />RESERVE</IdxTag>

            <SneakerSvg />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ num, label, last }: { num: string; label: string; last?: boolean }) {
  return (
    <div className={last ? 'pr-4' : 'border-r border-line pr-4'}>
      <div className="font-mono text-[28px] font-bold text-bone tracking-[-0.02em]">{num}</div>
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-concrete mt-1">{label}</div>
    </div>
  );
}

function IdxTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`absolute font-mono text-[10px] text-bone-2 tracking-[0.14em] z-[3] before:content-[''] before:block before:w-6 before:h-px before:bg-rust before:mb-[6px] ${className ?? ''}`}>
      {children}
    </span>
  );
}

function SneakerSvg() {
  return (
    <svg className="w-full h-full relative z-[2]" style={{ filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.6))' }} viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hero-leather" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a3a" />
          <stop offset="1" stopColor="#1a1a1a" />
        </linearGradient>
        <linearGradient id="hero-sole" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ebe6dc" />
          <stop offset="1" stopColor="#a39a87" />
        </linearGradient>
        <linearGradient id="hero-accent" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff6a2c" />
          <stop offset="1" stopColor="#c8531c" />
        </linearGradient>
      </defs>
      <path d="M 60 290 Q 50 320 90 330 L 510 330 Q 560 330 555 295 L 540 270 Q 520 260 500 265 L 90 270 Q 65 270 60 290 Z" fill="url(#hero-sole)" stroke="#0a0a0a" strokeWidth="2" />
      <path d="M 65 295 L 555 295" stroke="#c8531c" strokeWidth="3" fill="none" />
      <g stroke="#0a0a0a" strokeWidth="1.5" opacity="0.6">
        {[120, 160, 200, 240, 280, 320, 360, 400, 440, 480].map((x) => (
          <line key={x} x1={x} y1="305" x2={x} y2="325" />
        ))}
      </g>
      <path d="M 60 290 Q 50 220 90 180 L 130 180 L 130 270 L 60 270 Z" fill="url(#hero-leather)" stroke="#0a0a0a" strokeWidth="2" />
      <rect x="62" y="195" width="35" height="15" fill="url(#hero-accent)" stroke="#0a0a0a" strokeWidth="1" />
      <text x="79" y="206" fontFamily="Space Mono" fontSize="9" fill="#0a0a0a" textAnchor="middle" fontWeight="700">23</text>
      <path d="M 130 180 Q 200 140 320 130 L 460 150 Q 500 160 510 200 L 510 270 L 130 270 Z" fill="url(#hero-leather)" stroke="#0a0a0a" strokeWidth="2" />
      <path d="M 460 150 Q 510 160 530 200 L 540 245 Q 540 270 510 270 L 410 270 L 410 175 Z" fill="#0a0a0a" stroke="#0a0a0a" strokeWidth="2" />
      <path d="M 460 150 L 460 270" stroke="#1a1a1a" strokeWidth="1.5" />
      <path d="M 250 175 Q 230 220 220 270" stroke="#0a0a0a" strokeWidth="1.5" fill="none" />
      <path d="M 290 165 Q 275 220 270 270" stroke="#0a0a0a" strokeWidth="1.5" fill="none" />
      <path d="M 195 205 Q 175 215 165 245 L 200 250 L 240 220 Z" fill="url(#hero-accent)" stroke="#0a0a0a" strokeWidth="1.5" />
      <path d="M 240 145 Q 280 130 360 135 L 440 145 L 440 200 L 250 200 Z" fill="#0a0a0a" stroke="#0a0a0a" strokeWidth="2" />
      <g fill="#ebe6dc">
        <circle cx="270" cy="155" r="3" /><circle cx="320" cy="152" r="3" /><circle cx="370" cy="150" r="3" /><circle cx="420" cy="152" r="3" />
        <circle cx="270" cy="180" r="3" /><circle cx="320" cy="178" r="3" /><circle cx="370" cy="177" r="3" /><circle cx="420" cy="178" r="3" />
      </g>
      <g stroke="#ebe6dc" strokeWidth="2.5" fill="none">
        <line x1="270" y1="155" x2="420" y2="178" />
        <line x1="270" y1="180" x2="420" y2="152" />
        <line x1="320" y1="152" x2="320" y2="180" />
        <line x1="370" y1="150" x2="370" y2="177" />
      </g>
      <rect x="320" y="120" width="60" height="40" rx="4" fill="url(#hero-leather)" stroke="#0a0a0a" strokeWidth="1.5" />
      <text x="350" y="146" fontFamily="Archivo Black" fontSize="10" fill="#ebe6dc" textAnchor="middle">JUMPMAN</text>
      <rect x="395" y="225" width="55" height="25" fill="url(#hero-accent)" stroke="#0a0a0a" strokeWidth="1" />
      <text x="422" y="241" fontFamily="Archivo Black" fontSize="11" fill="#0a0a0a" textAnchor="middle">AJ4</text>
    </svg>
  );
}
