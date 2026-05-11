import { getFeaturedPosts } from '@/lib/queries/posts';
import { SectionHead } from './SectionHead';
import { SneakerThumb } from './SneakerThumb';
import { formatVnd, formatSize } from '@/lib/utils';
import type { PostWithSeller } from '@/types/database';

export async function DropsGrid() {
  const posts = await getFeaturedPosts(6);

  return (
    <section className="px-8 py-20 border-b border-line relative max-md:px-5 max-md:py-12">
      <SectionHead
        pretitle="Section 02 / Curated Drops"
        title={<>This week&apos;s<br />floor.</>}
        meta={<>Drop 47 / 26<br />Closes 23 nov 23:59 ICT</>}
      />

      <div className="grid grid-cols-3 border-t border-l border-line max-md:grid-cols-2 max-sm:grid-cols-1">
        {posts.map((post) => (
          <DropCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}

function DropCard({ post }: { post: PostWithSeller }) {
  // Decide status badge
  let statusLabel = 'Live';
  let statusClass = 'bg-rust text-ink';
  if (post.lot_id.startsWith('V-')) {
    statusLabel = 'Vault';
    statusClass = 'bg-ink text-bone border border-line-strong';
  } else if (post.market_avg_vnd && post.asking_price_vnd > post.market_avg_vnd) {
    statusLabel = '↑ Hot';
    statusClass = 'bg-hazard text-ink';
  } else {
    statusLabel = '● Live';
  }

  return (
    <a href={`/lot/${post.lot_id}`} className="border-r border-b border-line relative cursor-pointer transition-colors hover:bg-ink-2 group block">
      {/* image area */}
      <div className="aspect-[4/3] bg-ink-2 relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-blueprint-sm opacity-40" />

        <span className={`absolute top-[14px] left-[14px] font-mono text-[9px] tracking-[0.18em] uppercase py-1 px-2 z-[3] ${statusClass}`}>
          {statusLabel}
        </span>
        <span className="absolute top-[14px] right-[14px] font-mono text-[9px] tracking-[0.14em] text-concrete z-[3]">
          {post.lot_id}
        </span>

        <SneakerThumb
          brand={post.brand}
          colorway={post.colorway}
          className="relative z-[2] w-[78%] h-[78%] m-[11%_auto] block transition-transform duration-[400ms] ease-out group-hover:-rotate-[4deg] group-hover:scale-105"
          // @ts-expect-error -- inline drop-shadow style
          style={{ filter: 'drop-shadow(0 18px 24px rgba(0,0,0,0.5))' }}
        />
      </div>

      {/* info */}
      <div className="p-[18px_20px_20px]">
        <div className="font-mono text-[10px] tracking-[0.18em] text-concrete uppercase mb-[6px] flex justify-between">
          <span>{post.brand}</span>
          <span>{post.release_year ?? 'OG'}</span>
        </div>
        <div className="font-display text-[17px] tracking-[-0.01em] leading-[1.15] mb-[14px] uppercase">
          {post.model}
        </div>
        <div className="flex justify-between items-end pt-3 border-t border-line">
          <div className="font-mono text-base font-bold text-bone">
            <span className="text-[10px] text-concrete mr-[3px]">VNĐ</span>
            {formatVnd(post.asking_price_vnd)}
          </div>
          <div className="font-mono text-[10px] tracking-[0.1em] text-bone-2 text-right">
            <span className="text-concrete block text-[8px] tracking-[0.18em] mb-[2px]">Size</span>
            {formatSize(post.size_us)} US
          </div>
        </div>
      </div>
    </a>
  );
}
