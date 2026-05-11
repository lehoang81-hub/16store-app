/**
 * AssetThumb — hiển thị icon/thumbnail theo loại vật phẩm
 * Thay thế SneakerThumb cho non-sneaker assets
 */

type Palette = {
  upper: string;
  toe: string;
  heel: string;
  swoosh: string;
  laces: string;
  sole: string;
};

function paletteFor(brand: string, colorway: string | null): Palette {
  const c = (colorway ?? '').toLowerCase();
  const b = brand.toLowerCase();
  if (b.includes('travis')) {
    return { upper: '#d4d4d4', toe: '#7a8a4a', heel: '#7a8a4a', swoosh: '#7a8a4a', laces: '#ebe6dc', sole: '#ebe6dc' };
  }
  if (b.includes('yeezy') && c.includes('bred')) {
    return { upper: '#1a1a1a', toe: '#0a0a0a', heel: '#0a0a0a', swoosh: '#c8531c', laces: '#c8531c', sole: '#ebe6dc' };
  }
  if (b.includes('yeezy')) {
    return { upper: '#9a9a8a', toe: '#7a7a6a', heel: '#7a7a6a', swoosh: '#5a5a4a', laces: '#ebe6dc', sole: '#ebe6dc' };
  }
  if (c.includes('bred') || c.includes('red')) {
    return { upper: '#a02020', toe: '#1a1a1a', heel: '#1a1a1a', swoosh: '#1a1a1a', laces: '#ebe6dc', sole: '#ebe6dc' };
  }
  if (c.includes('mocha')) {
    return { upper: '#6b4a2a', toe: '#3a2a1a', heel: '#3a2a1a', swoosh: '#3a2a1a', laces: '#ebe6dc', sole: '#ebe6dc' };
  }
  if (c.includes('cobalt') || c.includes('blue')) {
    return { upper: '#1a3a5a', toe: '#ebe6dc', heel: '#ebe6dc', swoosh: '#ebe6dc', laces: '#1a3a5a', sole: '#ebe6dc' };
  }
  if (c.includes('panda') || (c.includes('black') && c.includes('white'))) {
    return { upper: '#ebe6dc', toe: '#1a1a1a', heel: '#1a1a1a', swoosh: '#1a1a1a', laces: '#ebe6dc', sole: '#ebe6dc' };
  }
  if (c.includes('grey') || c.includes('rain')) {
    return { upper: '#a0a0a0', toe: '#6a6a6a', heel: '#6a6a6a', swoosh: '#6a6a6a', laces: '#ebe6dc', sole: '#ebe6dc' };
  }
  return { upper: '#1a1a1a', toe: '#0a0a0a', heel: '#0a0a0a', swoosh: '#c8531c', laces: '#ebe6dc', sole: '#ebe6dc' };
}

// SVG icon theo asset_type
function AssetIcon({ assetType, className }: { assetType: string; className?: string }) {
  const icons: Record<string, string> = {
    watch:       '⌚',
    apparel:     '👕',
    gear:        '🎒',
    bag:         '👜',
    electronics: '📱',
    pet:         '🐾',
    medical:     '🦾',
    bib:         '🏅',
    other:       '📦',
  }
  const icon = icons[assetType] ?? '📦'

  return (
    <div className={`flex items-center justify-center bg-ink-2 ${className}`}>
      <span style={{ fontSize: 'clamp(24px, 40%, 48px)' }}>{icon}</span>
    </div>
  )
}

// Label đẹp theo asset_type
export function assetTypeLabel(assetType: string): string {
  const labels: Record<string, string> = {
    sneaker:     'Sneaker',
    watch:       'Đồng hồ',
    apparel:     'Trang phục',
    gear:        'Gear',
    bag:         'Túi xách',
    electronics: 'Điện tử',
    pet:         'Thú cưng',
    medical:     'Y tế',
    bib:         'BIB Race',
    other:       'Vật phẩm',
  }
  return labels[assetType] ?? 'Vật phẩm'
}

export function AssetThumb({
  brand,
  colorway,
  assetType,
  className,
}: {
  brand: string;
  colorway: string | null;
  assetType?: string;
  className?: string;
}) {
  // Non-sneaker → hiện icon
  if (assetType && assetType !== 'sneaker') {
    return <AssetIcon assetType={assetType} className={className} />
  }

  // Sneaker → SVG gốc
  const p = paletteFor(brand, colorway);
  return (
    <svg className={className} viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">
      <path d="M 60 290 Q 50 320 90 330 L 510 330 Q 560 330 555 295 L 540 270 Q 520 260 500 265 L 90 270 Q 65 270 60 290 Z" fill={p.sole} stroke="#0a0a0a" strokeWidth="2" />
      <path d="M 60 290 Q 50 220 90 180 L 130 180 L 130 270 L 60 270 Z" fill={p.heel} stroke="#0a0a0a" strokeWidth="2" />
      <path d="M 130 180 Q 200 140 320 130 L 460 150 Q 500 160 510 200 L 510 270 L 130 270 Z" fill={p.upper} stroke="#0a0a0a" strokeWidth="2" />
      <path d="M 460 150 Q 510 160 530 200 L 540 245 Q 540 270 510 270 L 410 270 L 410 175 Z" fill={p.toe} stroke="#0a0a0a" strokeWidth="2" />
      <path d="M 195 205 Q 175 215 165 245 L 200 250 L 240 220 Z" fill={p.swoosh} stroke="#0a0a0a" strokeWidth="1.5" />
      <path d="M 240 145 Q 280 130 360 135 L 440 145 L 440 200 L 250 200 Z" fill={p.toe} />
      <g fill={p.laces}>
        <circle cx="270" cy="155" r="3" /><circle cx="320" cy="152" r="3" /><circle cx="370" cy="150" r="3" /><circle cx="420" cy="152" r="3" />
      </g>
      <g stroke={p.laces} strokeWidth="2" fill="none">
        <line x1="270" y1="155" x2="420" y2="155" />
        <line x1="270" y1="178" x2="420" y2="178" />
      </g>
    </svg>
  );
}

// Backward compatible alias
export function SneakerThumb({ brand, colorway, className }: { brand: string; colorway: string | null; className?: string }) {
  return <AssetThumb brand={brand} colorway={colorway} assetType="sneaker" className={className} />
}