import { getAllHubs } from '@/lib/queries/hubs';
import { SectionHead } from './SectionHead';
import type { Hub } from '@/types/database';

export async function HubMap() {
  const hubs = await getAllHubs();
  const featured = hubs[0];

  return (
    <section className="px-8 py-20 border-b border-line max-md:px-5 max-md:py-12">
      <SectionHead
        pretitle="Section 04 / Physical Network"
        title={<>Hub vật lý<br />trên toàn quốc.</>}
        meta={<>{hubs.filter(h => h.status === 'open').length} active · {hubs.filter(h => h.status === 'setup').length} in setup<br />Mỗi hub có máy verify riêng</>}
      />

      <div className="grid grid-cols-[0.85fr_1fr] gap-0 border border-line max-lg:grid-cols-1">
        {/* hub list */}
        <div className="border-r border-line max-lg:border-r-0 max-lg:border-b">
          {hubs.map((hub, idx) => (
            <HubCard key={hub.id} hub={hub} num={idx + 1} active={idx === 0} />
          ))}
        </div>

        {/* map */}
        <div className="relative min-h-[480px] overflow-hidden bg-ink-2"
          style={{ background: 'radial-gradient(circle at 30% 40%, rgba(200,83,28,0.15), transparent 50%), var(--color-ink-2)' }}>
          <div className="absolute inset-0 bg-blueprint" style={{ backgroundSize: '40px 40px' }} />

          <div className="absolute top-[18px] right-[18px] font-mono text-[10px] tracking-[0.14em] text-bone-2 text-right leading-[1.5] z-[10]">
            <div className="text-concrete text-[8px] tracking-[0.2em]">CENTER</div>
            16.0544° N<br />108.2022° E<br />VN/ASIA
          </div>

          {/* pins */}
          <MapPin top="25%" left="48%" label="HN · Thái Hà" />
          <MapPin top="55%" left="42%" label="DN · Hải Châu" />
          <MapPin top="78%" left="58%" label="SGN · Q.1" />
          <MapPin top="85%" left="50%" label="CTO · Ninh Kiều" dim />

          {/* connecting lines */}
          <div className="absolute h-px z-[3] opacity-60" style={{ top: '25%', left: '48%', width: '14%', transform: 'rotate(56deg)', transformOrigin: 'left center', background: 'linear-gradient(90deg, transparent, var(--color-rust), transparent)' }} />
          <div className="absolute h-px z-[3] opacity-60" style={{ top: '55%', left: '42%', width: '18%', transform: 'rotate(48deg)', transformOrigin: 'left center', background: 'linear-gradient(90deg, transparent, var(--color-rust), transparent)' }} />
          <div className="absolute h-px z-[3] opacity-60" style={{ top: '78%', left: '50%', width: '8%', transform: 'rotate(28deg)', transformOrigin: 'left center', background: 'linear-gradient(90deg, transparent, var(--color-rust), transparent)' }} />

          {featured && (
            <div className="absolute bottom-6 left-6 z-[10] bg-ink border border-line-strong p-[18px_22px] max-w-[280px]">
              <div className="font-mono text-[10px] tracking-[0.18em] text-rust uppercase mb-[6px]">● Featured Hub</div>
              <h4 className="font-display text-lg tracking-[-0.01em] mb-2 uppercase">Hub {featured.name}</h4>
              <p className="text-xs text-bone-2 leading-[1.55]">
                Hub flagship của 16Store — {featured.verifier_count} verifier full-time, máy authenticate Entrupy + MFA, kho {featured.capacity} lots. Ký gửi nhận giày trong 24h.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function HubCard({ hub, num, active }: { hub: Hub; num: number; active?: boolean }) {
  const statusLabel = hub.status.toUpperCase();
  return (
    <div className={`p-7 px-7 border-b border-line cursor-pointer transition-colors hover:bg-ink-2 grid grid-cols-[auto_1fr_auto] gap-5 items-center last:border-b-0 ${active ? 'bg-ink-2 border-l-[3px] border-l-rust pl-[25px]' : ''}`}>
      <div className="font-display text-4xl text-rust leading-none">{String(num).padStart(2, '0')}</div>
      <div>
        <h3 className="font-display text-lg tracking-[-0.01em] uppercase mb-1">{hub.name}</h3>
        <div className="font-mono text-[11px] text-concrete tracking-[0.06em] uppercase">{hub.address}</div>
      </div>
      <div className="text-right font-mono text-[10px] tracking-[0.14em] text-bone-2 uppercase leading-[1.6]">
        <strong className="text-bone block text-sm">{statusLabel}</strong>
        {hub.active_lots} lots
      </div>
    </div>
  );
}

function MapPin({ top, left, label, dim }: { top: string; left: string; label: string; dim?: boolean }) {
  return (
    <div
      className={`absolute w-[14px] h-[14px] rounded-full cursor-pointer z-[5] ${dim ? 'bg-concrete' : 'bg-rust'}`}
      style={{
        top, left,
        transform: 'translate(-50%, -50%)',
        boxShadow: dim ? '0 0 0 3px rgba(107,102,96,0.2)' : '0 0 0 4px rgba(200,83,28,0.3), 0 0 24px var(--color-rust-glow)',
      }}
    >
      <span className="absolute top-[18px] left-1/2 -translate-x-1/2 font-mono text-[9px] tracking-[0.16em] text-bone uppercase whitespace-nowrap bg-ink py-[3px] px-[6px] border border-line-strong">
        {label}
      </span>
    </div>
  );
}
