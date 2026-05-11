// src/app/race/layout.tsx
// HLRace layout — tách biệt khỏi 16Store nhưng dùng chung auth

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HLRace — Race Operations',
  description: 'Nền tảng quản lý giải chạy bộ',
};

export default function RaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        // HLRace design tokens — không conflict với 16Store tokens
        '--hl-bg':      '#0a0e1a',
        '--hl-surface': '#111827',
        '--hl-card':    '#1a2235',
        '--hl-border':  '#1f2d45',
        '--hl-accent':  '#f97316',
        '--hl-green':   '#10b981',
        '--hl-blue':    '#3b82f6',
        '--hl-red':     '#ef4444',
        '--hl-warn':    '#f59e0b',
        '--hl-text':    '#e2e8f0',
        '--hl-muted':   '#64748b',
      } as React.CSSProperties}
      className="min-h-screen bg-[var(--hl-bg)] text-[var(--hl-text)] font-sans"
    >
      {children}
    </div>
  );
}
