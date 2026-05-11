const TICKER_ITEMS = [
  '◉ Live drop · jordan 4 bred reimagined · vnđ 6.8M',
  'hub thái hà · 24 lots in queue',
  '◉ syndicate · sb dunk panda lot ×12',
  'weekly index · +4.2%',
  'verified · 1,847 pairs ytd',
];

export function Ticker() {
  // Duplicate for seamless scroll
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div className="bg-rust text-ink border-b border-ink overflow-hidden relative">
      <div className="flex gap-12 whitespace-nowrap animate-ticker py-[7px] font-mono text-[11px] font-bold uppercase tracking-[0.18em]">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-3 after:content-['◆'] after:text-ink after:opacity-40 after:ml-12">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
