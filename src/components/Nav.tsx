import { Search } from 'lucide-react';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/queries/current-user';

export async function Nav() {
  const user = await getCurrentUser();

  return (
    <nav className="sticky top-0 z-[100] bg-ink/85 backdrop-blur-xl border-b border-line">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-8 py-[18px] gap-8 max-md:grid-cols-[1fr_auto] max-md:px-5 max-md:py-[14px]">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-[10px] font-display text-[22px] tracking-[-0.02em]">
          <span className="text-rust italic">16</span>STORE
          <span className="font-mono text-[9px] font-normal text-concrete tracking-[0.2em] border-l border-line pl-[10px] ml-[6px] leading-[1.3] uppercase">
            heritage<br />consignment
          </span>
        </Link>

        {/* Links */}
        <div className="flex justify-center gap-7 font-mono text-[11px] tracking-[0.16em] uppercase max-md:hidden">
          <NavLink href="/" active>Floor</NavLink>
          <NavLink href="#">Drops</NavLink>
          <NavLink href="#">Vault</NavLink>
          <NavLink href="#">Hubs</NavLink>
          <NavLink href="#">Index</NavLink>
          {user && <NavLink href="/dashboard">Dashboard</NavLink>}
          {user && <NavLink href="/dashboard/orders">Đơn hàng</NavLink>}
          {user && user.role === 'super_admin' && (
            <NavLink href="/admin/overview">
              <span className="text-rust">◆</span> Overview
            </NavLink>
          )}
          {user && (user.role === 'hub_admin' || user.role === 'super_admin') && (
            <NavLink href="/admin/hub">
              <span className="text-rust">●</span> Admin
            </NavLink>
          )}
          {user && user.role === 'super_admin' && (
            <NavLink href="/admin/settings">
              <span className="text-rust">⚙</span> Settings
            </NavLink>
          )}
          {user && user.role === 'super_admin' && (
            <NavLink href="/admin/orders">
              <span className="text-rust">◈</span> Orders
            </NavLink>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end items-center gap-4">
          <button
            aria-label="Search"
            className="w-9 h-9 border border-line bg-transparent text-bone inline-flex items-center justify-center cursor-pointer hover:bg-bone hover:text-ink transition-all"
          >
            <Search size={14} />
          </button>

          {user ? (
            <>
              <Link
                href="/settings"
                className="font-mono text-[11px] tracking-[0.14em] text-bone/70 hover:text-bone transition-colors uppercase max-md:hidden"
              >
                @{user.handle}
              </Link>
              <Link
                href="/submit"
                className="bg-rust text-ink px-5 py-[11px] font-mono text-[11px] font-bold tracking-[0.16em] uppercase inline-flex items-center gap-2 hover:bg-bone transition-colors group"
              >
                Ký gửi pair
                <span className="group-hover:translate-x-[3px] transition-transform">→</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="font-mono text-[11px] tracking-[0.14em] text-bone/70 hover:text-bone transition-colors uppercase"
              >
                Đăng nhập
              </Link>
              <Link
                href="/login"
                className="bg-rust text-ink px-5 py-[11px] font-mono text-[11px] font-bold tracking-[0.16em] uppercase inline-flex items-center gap-2 hover:bg-bone transition-colors group"
              >
                Bắt đầu
                <span className="group-hover:translate-x-[3px] transition-transform">→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  children,
  href,
  active,
}: {
  children: React.ReactNode;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative pb-1 transition-colors hover:text-rust ${
        active ? 'text-bone' : 'text-bone/70'
      }`}
    >
      {children}
      {active && <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-rust" />}
    </Link>
  );
}
