export function Process() {
  return (
    <section className="bg-bone text-ink py-25 px-8 border-b border-ink relative overflow-hidden max-md:py-15 max-md:px-5"
      style={{ paddingTop: '100px', paddingBottom: '100px' }}>
      <div className="absolute inset-0" style={{
        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 60px, rgba(0,0,0,0.025) 60px, rgba(0,0,0,0.025) 62px)'
      }} />

      <div className="max-w-[1200px] mx-auto relative">
        <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-concrete flex items-center gap-3 before:content-[''] before:w-8 before:h-px before:bg-rust">
          Section 05 / The way it works
        </div>
        <h2 className="font-display text-[clamp(48px,6vw,88px)] leading-[0.92] tracking-[-0.035em] uppercase mt-[14px] mb-3">
          Bốn bước,<br />
          <span className="font-serif italic font-normal text-rust normal-case">không phải</span><br />
          bốn ngàn dòng chat.
        </h2>
        <p className="text-base text-concrete max-w-[540px] mb-15 leading-[1.55]">
          Quy trình ký gửi của 16Store thay thế hoàn toàn flow trên các nhóm chat — tự động hoá ở mỗi bước, minh bạch ở mỗi giao dịch.
        </p>

        <div className="grid grid-cols-4 gap-0 border-t border-l border-ink max-md:grid-cols-2 max-sm:grid-cols-1">
          <Step num="01 / SUBMIT" title={<>Đăng ký<br />gửi.</>}>
            Upload ảnh, size, tình trạng. Hệ thống pricing engine của 16Store tự gợi ý mức giá dựa trên 6 tháng dữ liệu thị trường.
          </Step>
          <Step num="02 / VERIFY" title={<>Verify 4<br />bước.</>}>
            Mang đến hub gần nhất hoặc đặt pickup. Mỗi pair được kiểm 4 bước: stitching, sole, materials, và OG box authentication.
          </Step>
          <Step num="03 / LIST" title={<>Lên<br />floor.</>}>
            Pair được catalog với LOT ID, lên floor công khai và push tới buyers theo size match. Không cần tag bạn bè trong group.
          </Step>
          <Step num="04 / PAYOUT" title={<>Nhận<br />tiền 72H.</>}>
            Khi pair được mua, tiền về tài khoản trong 72h. Phí ký gửi cố định 12%, không có chi phí ẩn nào khác.
          </Step>
        </div>

        <div className="mt-15 flex items-center gap-6 pt-7 border-t border-ink max-sm:flex-col max-sm:items-start">
          <button className="bg-ink text-bone px-7 py-4 font-mono text-xs font-bold tracking-[0.18em] uppercase inline-flex items-center gap-3 hover:bg-rust hover:text-ink transition-colors">
            Submit your first pair <span>→</span>
          </button>
          <span className="font-mono text-[11px] tracking-[0.14em] text-concrete uppercase">
            Hoặc đọc <a href="#" className="text-ink underline">consignment terms</a>
          </span>
        </div>
      </div>
    </section>
  );
}

function Step({ num, title, children }: { num: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-r border-b border-ink p-7 px-6 transition-colors hover:bg-black/5">
      <div className="font-mono text-[11px] tracking-[0.2em] text-rust mb-4">→ {num}</div>
      <h3 className="font-display text-[22px] tracking-[-0.01em] uppercase mb-3 leading-[1.05]">{title}</h3>
      <p className="text-[13px] text-concrete leading-[1.6]">{children}</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────── FOOTER */
export function Footer() {
  return (
    <footer className="py-15 pt-15 pb-8 px-8 bg-ink max-md:px-5">
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-12 mb-15 pb-10 border-b border-line max-lg:grid-cols-2 max-lg:gap-8">
        <div>
          <h3 className="font-display text-[32px] tracking-[-0.02em] mb-[14px]">
            <span className="text-rust italic">16</span>STORE
          </h3>
          <p className="text-[13px] text-concrete leading-[1.6] max-w-[320px] mb-5">
            Sàn ký gửi sneaker được verify, vận hành bởi hệ thống hub vật lý trên toàn Việt Nam. Một mảnh trong hệ sinh thái 16 — di sản và nông nghiệp số.
          </p>
          <div className="flex gap-[10px]">
            {['FB', 'IG', 'TT'].map((s) => (
              <button key={s} className="w-9 h-9 border border-line-strong bg-transparent text-bone inline-flex items-center justify-center font-mono text-[11px] hover:bg-bone hover:text-ink transition-all">{s}</button>
            ))}
          </div>
        </div>

        <FootCol title="Floor" links={['All listings', 'Featured drops', 'Vault', 'Index']} />
        <FootCol title="Sell" links={['Submit a pair', 'Pricing engine', 'Syndicate', 'Pricing rules']} />
        <FootCol title="Hubs" links={['Thái Hà · HN', 'Q.1 · SGN', 'Đà Nẵng', 'Cần Thơ']} />
        <FootCol title="16 Eco" links={['Heritage', 'Agriculture', 'Reputation', 'QR Codes']} />
      </div>

      <div className="flex justify-between font-mono text-[10px] tracking-[0.16em] text-concrete uppercase max-md:flex-col max-md:gap-2">
        <span>© 2026 16STORE · ALL RIGHTS RESERVED</span>
        <span>HÀ NỘI · 21°01&apos;N 105°50&apos;E</span>
        <span>BUILD V2.0.16 · OPS NORMAL</span>
      </div>
    </footer>
  );
}

function FootCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h5 className="font-mono text-[10px] tracking-[0.2em] text-rust uppercase mb-[14px]">{title}</h5>
      {links.map((l) => (
        <a key={l} href="#" className="block text-bone-2 no-underline text-[13px] py-[5px] hover:text-bone transition-colors">{l}</a>
      ))}
    </div>
  );
}
