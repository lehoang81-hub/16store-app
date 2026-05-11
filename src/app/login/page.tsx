
export const dynamic = 'force-dynamic';
import { LoginForm } from '@/components/LoginForm';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 bg-blueprint opacity-30" />

      {/* Corner decorations */}
      <div className="absolute top-6 left-6 font-mono text-[10px] text-concrete tracking-[0.2em] uppercase">
        16STORE / AUTH GATEWAY
      </div>
      <div className="absolute top-6 right-6 font-mono text-[10px] text-rust tracking-[0.2em] uppercase">
        ● SECURE
      </div>
      <div className="absolute bottom-6 left-6 font-mono text-[10px] text-concrete tracking-[0.2em] uppercase">
        BUILD V2.0.16
      </div>
      <div className="absolute bottom-6 right-6 font-mono text-[10px] text-concrete tracking-[0.2em] uppercase">
        HÀ NỘI · 21°01&apos;N
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        <Link href="/" className="font-display text-[40px] tracking-[-0.02em] block text-center mb-2">
          <span className="text-rust italic">16</span>STORE
        </Link>
        <div className="font-mono text-[10px] text-concrete tracking-[0.2em] uppercase text-center mb-12">
          Heritage · Consignment
        </div>

        <div className="border border-line-strong p-8 bg-ink-2 relative">
          {/* Corner ticks */}
          <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-rust" />
          <span className="absolute top-0 right-0 w-3 h-3 border-t border-r border-rust" />
          <span className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-rust" />
          <span className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-rust" />

          <div className="font-mono text-[11px] text-rust tracking-[0.2em] uppercase mb-2 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Đăng nhập / Đăng ký
          </div>
          <h1 className="font-display text-[28px] leading-[1] tracking-[-0.02em] uppercase mb-2">
            Một tài khoản<br />
            <span className="font-serif italic font-normal text-rust normal-case">hai nền tảng</span>.
          </h1>
          <p className="text-sm text-bone-2 leading-[1.5] mb-6">
            Đăng nhập một lần — dùng được cả 16Store lẫn HLRace. Không cần tạo tài khoản mới.
          </p>

          <LoginForm />

          <div className="mt-6 pt-6 border-t border-line font-mono text-[10px] text-concrete tracking-[0.14em] uppercase leading-[1.6]">
            Bằng cách tiếp tục, bạn đồng ý với điều khoản ký gửi và chính sách quyền riêng tư của 16Store.
          </div>
        </div>

        <div className="mt-8 text-center font-mono text-[10px] text-concrete tracking-[0.2em] uppercase">
          ← <Link href="/" className="hover:text-bone transition-colors">Quay lại trang chủ</Link>
        </div>
      </div>
    </div>
  );
}
