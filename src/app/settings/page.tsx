import { getCurrentUser } from '@/lib/queries/current-user';
import { Nav } from '@/components/Nav';
import { TelegramLinkSection } from '@/components/TelegramLinkSection';
import { redirect } from 'next/navigation';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect=/settings');

  return (
    <>
      <Nav />
      <main className="px-8 py-12 max-w-[800px] mx-auto max-md:px-5 max-md:py-8">
        <div className="font-mono text-[11px] tracking-[0.2em] text-rust uppercase mb-3 flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
          Settings / Cài đặt tài khoản
        </div>
        <h1 className="font-display text-[clamp(36px,4vw,56px)] leading-[0.95] tracking-[-0.03em] uppercase mb-12">
          Cài đặt
        </h1>

        {/* Profile */}
        <Section title="Hồ sơ">
          <Row label="Handle" value={`@${user.handle}`} />
          <Row label="Tên hiển thị" value={user.display_name ?? '—'} />
          <Row label="Vai trò" value={user.role} />
          <Row label="Reputation" value={String(user.reputation_score)} />
        </Section>

        {/* Telegram */}
        <Section title="Telegram bot">
          <TelegramLinkSection
            isLinked={!!user.telegram_chat_id}
            telegramUsername={user.telegram_username}
            notificationsEnabled={user.notifications_enabled}
          />
        </Section>

        {/* Sign out */}
        <Section title="Tài khoản">
          <form action="/auth/signout" method="POST">
            <button type="submit" className="border border-line-strong text-bone-2 py-3 px-6 font-mono text-[11px] tracking-[0.18em] uppercase hover:border-rust hover:text-rust transition-colors">
              Đăng xuất
            </button>
          </form>
        </Section>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10 pb-10 border-b border-line last:border-b-0">
      <h2 className="font-display text-xl uppercase tracking-[-0.01em] mb-6">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-3 border-b border-dotted border-line text-sm">
      <span className="font-mono text-[11px] text-concrete tracking-[0.14em] uppercase">{label}</span>
      <span className="text-bone-2">{value}</span>
    </div>
  );
}
