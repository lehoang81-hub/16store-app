import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format VNĐ amount: 6800000 → "6.8M"
 */
export function formatVnd(amount: number, opts?: { full?: boolean }): string {
  if (opts?.full) {
    return new Intl.NumberFormat('vi-VN').format(amount);
  }
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000)}K`;
  }
  return `${amount}`;
}

/**
 * Time-ago string
 */
export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/**
 * Format size_us
 */
export function formatSize(size: number): string {
  return size % 1 === 0 ? `${size}` : `${size}`;
}

/**
 * Compare price vs market avg
 */
export function priceDelta(price: number, avg: number | null) {
  if (!avg || avg === price) return { text: '— at avg', direction: 'flat' as const };
  const diff = price - avg;
  const formatted = formatVnd(Math.abs(diff));
  return {
    text: diff > 0 ? `↑ ${formatted} vs avg` : `↓ ${formatted} vs avg`,
    direction: diff > 0 ? ('up' as const) : ('down' as const),
  };
}

export function conditionLabel(c: string): string {
  switch (c) {
    case 'DS': return 'DS';
    case 'VNDS': return 'VNDS';
    case '9_5': return '9.5/10';
    case '9': return '9/10';
    case '8_5': return '8.5/10';
    case '8': return '8/10';
    default: return c;
  }
}
