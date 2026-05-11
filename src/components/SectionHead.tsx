export function SectionHead({
  pretitle,
  title,
  meta,
}: {
  pretitle: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-end mb-12 pb-4 border-b border-line gap-6 max-md:flex-col max-md:items-start max-md:gap-4">
      <div>
        <div className="font-mono text-[11px] tracking-[0.2em] text-rust uppercase mb-3 flex gap-[10px] items-center before:content-[''] before:w-2 before:h-2 before:bg-rust">
          {pretitle}
        </div>
        <h2 className="font-display text-[clamp(32px,4vw,56px)] leading-[0.95] tracking-[-0.03em] uppercase">
          {title}
        </h2>
      </div>
      {meta && (
        <div className="font-mono text-[11px] tracking-[0.16em] text-concrete uppercase text-right leading-[1.6] max-md:text-left">
          {meta}
        </div>
      )}
    </div>
  );
}
