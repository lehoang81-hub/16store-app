import { getFloorPosts } from '@/lib/queries/posts';
import { getAllHubs } from '@/lib/queries/hubs';
import { SectionHead } from './SectionHead';
import { SneakerThumb } from './SneakerThumb';
import { formatVnd, formatSize, timeAgo, priceDelta, conditionLabel } from '@/lib/utils';
import type { PostWithSeller, Hub } from '@/types/database';

export async function ConsignmentFloor() {
  const [posts, hubs] = await Promise.all([getFloorPosts(20), getAllHubs()]);

  return (
    <section className="px-8 py-20 border-b border-line bg-ink-2 max-md:px-5 max-md:py-12">
      <SectionHead
        pretitle="Section 03 / Consignment Floor"
        title={
          <>
            Sàn ký gửi.<br />
            <span className="font-serif italic font-normal text-rust normal-case">không cần</span> nhóm chat.
          </>
        }
        meta={<>Updated every 30s<br />All listings verified</>}
      />

      <div className="grid grid-cols-[280px_1fr_320px] gap-0 border border-line min-h-[720px] max-lg:grid-cols-1">
        <FilterRail hubs={hubs} />
        <FeedRail posts={posts} />
        <ActivityRail posts={posts} hubs={hubs} />
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────── FILTER RAIL */
function FilterRail({ hubs }: { hubs: Hub[] }) {
  const sizes = ['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '13'];
  return (
    <aside className="border-r border-line p-6 px-5 bg-ink max-lg:hidden">
      <div className="font-mono text-[10px] tracking-[0.2em] text-concrete uppercase pb-3 border-b border-line mb-4 flex justify-between items-center">
        Filter / Sàng
        <span className="bg-rust text-ink py-[2px] px-[6px] text-[9px]">12</span>
      </div>

      <FilterGroup label="Brand">
        <div className="flex flex-wrap gap-[6px]">
          {['All', 'Nike', 'Jordan', 'Adidas', 'NB', 'Yeezy', 'SB'].map((b, i) => (
            <Chip key={b} active={i === 0}>{b}</Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Size" hint="US">
        <div className="grid grid-cols-4 gap-1">
          {sizes.map((s) => (
            <SizeCell key={s} active={s === '9' || s === '9.5'} disabled={s === '7' || s === '13'}>
              {s}
            </SizeCell>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Price Range" hint="VNĐ">
        <div className="h-1 bg-ink-3 relative my-3 mb-2">
          <div className="absolute left-[18%] right-[22%] top-0 h-full bg-rust" />
          <div className="absolute w-[10px] h-[10px] bg-bone -top-[3px] rounded-full" style={{ left: 'calc(18% - 5px)' }} />
          <div className="absolute w-[10px] h-[10px] bg-bone -top-[3px] rounded-full" style={{ right: 'calc(22% - 5px)' }} />
        </div>
        <div className="flex justify-between font-mono text-[10px] text-concrete">
          <span>2.5M</span>
          <span>9.0M</span>
        </div>
      </FilterGroup>

      <FilterGroup label="Condition">
        <div className="flex flex-wrap gap-[6px]">
          {['DS', 'VNDS', '9.5/10', '9/10'].map((c, i) => (
            <Chip key={c} active={i === 0}>{c}</Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Hub">
        <div className="flex flex-wrap gap-[6px]">
          {hubs.map((h, i) => (
            <Chip key={h.id} active={i === 0}>{h.name}</Chip>
          ))}
        </div>
      </FilterGroup>
    </aside>
  );
}

function FilterGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-[26px]">
      <div className="font-mono text-[10px] tracking-[0.16em] text-bone-2 uppercase mb-[10px] flex justify-between">
        {label} {hint && <span className="text-concrete">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={`border py-[6px] px-[10px] font-mono text-[10px] tracking-[0.08em] cursor-pointer transition-all ${
        active
          ? 'bg-bone text-ink border-bone'
          : 'bg-transparent text-bone-2 border-line-strong hover:border-bone hover:text-bone'
      }`}
    >
      {children}
    </button>
  );
}

function SizeCell({ children, active, disabled }: { children: React.ReactNode; active?: boolean; disabled?: boolean }) {
  return (
    <div
      className={`border text-center font-mono text-[11px] py-2 transition-all ${
        disabled
          ? 'border-line-strong opacity-30 line-through cursor-not-allowed'
          : active
          ? 'bg-rust text-ink border-rust'
          : 'border-line-strong cursor-pointer hover:border-rust hover:text-rust'
      }`}
    >
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────── FEED RAIL */
function FeedRail({ posts }: { posts: PostWithSeller[] }) {
  return (
    <div className="flex flex-col">
      <div className="p-[18px_24px] border-b border-line flex justify-between items-center">
        <div className="flex gap-[18px] items-center">
          <FeedTab active>
            <span className="inline-block w-2 h-2 rounded-full bg-rust mr-2 animate-pulse-rust" />
            Live · {posts.filter((p) => p.status === 'live').length}
          </FeedTab>
          <FeedTab>Bid open · 12</FeedTab>
          <FeedTab>Reserved · {posts.filter((p) => p.status === 'reserved').length}</FeedTab>
        </div>
        <div className="font-mono text-[11px] tracking-[0.14em] text-bone-2 uppercase">Sort ↓ Newest</div>
      </div>

      <div className="flex-1 overflow-hidden">
        {posts.slice(0, 8).map((post, idx) => (
          <ListingRow key={post.id} post={post} isNew={idx < 2} />
        ))}
      </div>
    </div>
  );
}

function FeedTab({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div className={`font-mono text-[11px] tracking-[0.16em] uppercase cursor-pointer py-1 relative ${active ? 'text-bone' : 'text-concrete'}`}>
      {children}
      {active && <span className="absolute -bottom-[19px] left-0 right-0 h-[2px] bg-rust" />}
    </div>
  );
}

function ListingRow({ post, isNew }: { post: PostWithSeller; isNew: boolean }) {
  const delta = priceDelta(post.asking_price_vnd, post.market_avg_vnd);
  const deltaColor = delta.direction === 'up' ? 'text-[#6ec070]' : delta.direction === 'down' ? 'text-rust' : 'text-concrete';

  // ── Mystery Box logic ──────────────────────────────────
  const isMystery = (post as any).is_mystery === true && post.status !== 'sold'

  return (
    <a
      href={`/lot/${post.lot_id}`}
      className={`grid grid-cols-[80px_1fr_auto_auto] gap-[18px] items-center p-[16px_24px] border-b border-line cursor-pointer transition-colors hover:bg-ink relative max-sm:grid-cols-[60px_1fr_auto] ${
        isNew ? "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-rust" : ''
      } ${isMystery ? 'before:bg-hazard' : ''}`}
    >
      {/* Thumbnail */}
      <div className={`w-[70px] h-[70px] relative flex items-center justify-center border ${
        isMystery ? 'bg-ink border-hazard/40' : 'bg-ink-3 border-line'
      }`}>
        {isMystery ? (
          <div className="flex flex-col items-center justify-center gap-1">
            <span className="text-2xl">?</span>
            <span className="font-mono text-[8px] text-hazard tracking-[0.1em] uppercase">Mystery</span>
          </div>
        ) : (
          <SneakerThumb brand={post.brand} colorway={post.colorway} className="w-[90%] h-[90%]" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0">
        <div className="flex gap-2 items-center mb-1 font-mono text-[9px] tracking-[0.14em] text-concrete uppercase">
          <span className="text-rust">@{post.seller_handle}</span>
          <span>·</span>
          <span className="text-bone-2">{timeAgo(post.listed_at)}</span>
          <span>·</span>
          <span>HUB {post.hub_name ?? '—'}</span>
        </div>

        {isMystery ? (
          /* Mystery: ẩn brand/model, chỉ hiện size + condition */
          <div className="font-display text-sm tracking-[-0.01em] uppercase mb-1 text-hazard">
            ??? · Blind Box
          </div>
        ) : (
          <div className="font-display text-sm tracking-[-0.01em] uppercase mb-1 truncate">
            {post.model}
          </div>
        )}

        <div className="flex gap-[6px] flex-wrap">
          {!isMystery && post.verify_stitching && post.verify_sole && post.verify_materials && (
            <Tag verified>✓ Verified 4-step</Tag>
          )}
          {isMystery && <Tag mystery>✦ Mystery Box</Tag>}
          <Tag>{conditionLabel(post.condition)}{post.verify_box ? ' · w/ box' : ''}</Tag>
          {!isMystery && post.release_year && <Tag>{post.release_year}</Tag>}
        </div>
      </div>

      {/* Size */}
      <div className="font-mono text-right max-sm:hidden">
        <div className="text-lg font-bold text-bone">{formatSize(post.size_us)}</div>
        <div className="text-[8px] text-concrete tracking-[0.18em] uppercase">US</div>
      </div>

      {/* Price */}
      <div className="font-mono text-right min-w-[110px]">
        <div className="text-lg font-bold text-bone">{formatVnd(post.asking_price_vnd)}</div>
        {isMystery ? (
          <div className="text-[10px] tracking-[0.1em] mt-[2px] text-hazard">Blind price</div>
        ) : (
          <div className={`text-[10px] tracking-[0.1em] mt-[2px] ${deltaColor}`}>{delta.text}</div>
        )}
      </div>
    </a>
  );
}

function Tag({ children, verified, mystery }: { children: React.ReactNode; verified?: boolean; mystery?: boolean }) {
  return (
    <span className={`font-mono text-[9px] tracking-[0.1em] uppercase py-[2px] px-[6px] border ${
      verified
        ? 'text-rust border-rust'
        : mystery
        ? 'text-hazard border-hazard/50'
        : 'text-bone-2 border-line'
    }`}>
      {children}
    </span>
  );
}

/* ──────────────────────────────────────────────────────── ACTIVITY RAIL */
function ActivityRail({ posts, hubs }: { posts: PostWithSeller[]; hubs: Hub[] }) {
  return (
    <aside className="border-l border-line bg-ink flex flex-col max-lg:hidden">
      <div className="p-5 px-[22px] border-b border-line">
        <h4 className="font-mono text-[10px] tracking-[0.2em] text-concrete uppercase mb-[14px] flex justify-between items-center">
          Live activity <span className="text-rust">◉</span>
        </h4>
        <ActivityItem
          marker="rust"
          text={<><strong className="text-bone font-medium">@duy_archive</strong> đăng ký gửi <strong className="text-bone font-medium">AJ4 Bred</strong></>}
          when="2 min ago · hub thái hà"
        />
        <ActivityItem
          marker="moss"
          text={<><strong className="text-bone font-medium">@longnguyen</strong> mua <strong className="text-bone font-medium">SB Dunk Panda</strong> với giá 4.2M</>}
          when="8 min ago · payout cleared"
        />
        <ActivityItem
          marker="bone"
          text={<><strong className="text-bone font-medium">HUB Đà Nẵng</strong> verified <strong className="text-bone font-medium">NB 990v3</strong> qua step 4</>}
          when="14 min ago"
        />
        <ActivityItem
          marker="rust"
          text={<>Syndicate <strong className="text-bone font-medium">SB Panda Lot ×12</strong> mở deal cho 3 buyers</>}
          when="22 min ago"
        />
        <ActivityItem
          marker="bone"
          text={<><strong className="text-bone font-medium">@minhsneaker</strong> cập nhật pricing: AJ1 Mocha</>}
          when="35 min ago"
        />
      </div>

      <div className="p-5 px-[22px] border-b border-line">
        <h4 className="font-mono text-[10px] tracking-[0.2em] text-concrete uppercase mb-[14px]">Hub status</h4>
        {hubs.map((h) => (
          <HubRow key={h.id} hub={h} />
        ))}
      </div>

      <div className="p-5 px-[22px] bg-ink-2 flex-1">
        <h4 className="font-mono text-[10px] tracking-[0.2em] text-concrete uppercase mb-[14px] flex justify-between">
          16 Index <span className="text-[#6ec070]">+4.2%</span>
        </h4>
        <div className="font-display text-[38px] leading-none my-2 mb-1">
          1,284<span className="text-rust italic font-serif font-normal">.46</span>
        </div>
        <div className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase mb-[14px]">
          7-day floor pricing index
        </div>
        <svg viewBox="0 0 240 60" width="100%" height="60">
          <polyline points="0,42 24,38 48,40 72,32 96,35 120,28 144,30 168,22 192,18 216,20 240,12" fill="none" stroke="var(--color-rust)" strokeWidth="1.8" />
          <polyline points="0,42 24,38 48,40 72,32 96,35 120,28 144,30 168,22 192,18 216,20 240,12 240,60 0,60" fill="rgba(200,83,28,0.15)" stroke="none" />
        </svg>
      </div>
    </aside>
  );
}

function ActivityItem({ marker, text, when }: { marker: 'rust' | 'bone' | 'moss'; text: React.ReactNode; when: string }) {
  const markerClass = marker === 'rust' ? 'bg-rust' : marker === 'moss' ? 'bg-moss' : 'bg-bone-2';
  return (
    <div className="flex gap-[10px] py-[10px] text-xs leading-[1.5] border-b border-dotted border-line last:border-b-0">
      <div className={`w-[6px] h-[6px] rounded-full mt-[7px] flex-shrink-0 ${markerClass}`} />
      <div className="text-bone-2">
        {text}
        <span className="block font-mono text-[9px] text-concrete tracking-[0.12em] mt-[2px] uppercase">{when}</span>
      </div>
    </div>
  );
}

function HubRow({ hub }: { hub: Hub }) {
  const dotClass = hub.status === 'open' ? 'bg-[#6ec070]' : hub.status === 'busy' ? 'bg-hazard' : 'bg-concrete';
  return (
    <div className="flex justify-between items-center py-2 border-b border-dotted border-line last:border-b-0 text-xs">
      <span className="font-mono text-[10px] tracking-[0.12em] text-bone uppercase">{hub.name} · {hub.city.split(' ').pop()}</span>
      <span className="flex gap-2 items-center font-mono text-[11px] text-bone-2">
        <span className={`inline-block w-[6px] h-[6px] rounded-full ${dotClass}`} />
        {hub.status.toUpperCase()} · {hub.active_lots} lots
      </span>
    </div>
  );
}
