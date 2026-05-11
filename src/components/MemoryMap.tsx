'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface ScanEvent {
  id: string;
  scan_type: string;
  city: string | null;
  country: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
}

interface OwnershipEntry {
  owner_id: string | null;
  acquired_at: string;
  released_at: string | null;
  hub_id: string | null;
  acquisition_type: string | null;
}

// ── NEW: Journal GPS points ────────────────────────────────────
interface JournalPoint {
  id:          string;
  title:       string;
  content:     string;
  entry_date:  string;
  entry_type:  string;
  lat:         number;
  lng:         number;
  owner_handle?: string;
}

interface Props {
  scans:        ScanEvent[];
  ownership:    OwnershipEntry[];
  privacyMode:  string;
  lotId:        string;
  journalPoints?: JournalPoint[]; // ← NEW optional prop
}

const CITY_COORDS: Record<string, [number, number]> = {
  'Hà Nội':    [105.8542, 21.0285],
  'HCM':       [106.6602, 10.7626],
  'Đà Nẵng':   [108.2022, 16.0544],
  'Hải Phòng': [106.6881, 20.8449],
  'Cần Thơ':   [105.7469, 10.0452],
  'Nha Trang': [109.1967, 12.2388],
  'Đà Lạt':   [108.4583, 11.9404],
  'Hội An':    [108.3380, 15.8800],
  'Huế':       [107.5909, 16.4637],
  'Vũng Tàu':  [107.1364, 10.4114],
  'Phú Quốc':  [103.9678, 10.2870],
};

// Journal entry type → marker color
function journalPinColor(type: string): string {
  const map: Record<string, string> = {
    location:   '#C8531C',   // Rust — checkin
    experience: '#d4af37',   // Gold — experience
    memory:     '#5DCAA5',   // Teal — memory (paid)
    repair:     '#6ec070',   // Green — repair
    other:      '#888888',   // Grey — other
  };
  return map[type] ?? '#C8531C';
}

// Journal popup HTML
function renderJournalPopup(point: JournalPoint): string {
  const date = new Date(point.entry_date).toLocaleDateString('vi-VN');
  const preview = point.content.length > 160
    ? point.content.substring(0, 160) + '...'
    : point.content;
  const color = journalPinColor(point.entry_type);
  const isPaid = point.entry_type === 'memory';

  return `
    <div style="min-width:200px; max-width:240px;">
      <div style="color:${color}; font-size:9px; letter-spacing:0.18em; text-transform:uppercase; margin-bottom:5px;">
        ${point.entry_type} · ${date}
        ${point.owner_handle ? `· @${point.owner_handle}` : ''}
      </div>
      <div style="font-family:'Space Mono',monospace; font-size:11px; font-weight:700; color:#ebe6dc; margin-bottom:7px; line-height:1.4;">
        ${point.title.replace('📍 ', '').replace(/Checkin #\d+: /, '')}
      </div>
      <div style="font-family:Georgia,serif; font-size:11px; color:rgba(235,230,220,0.7); line-height:1.6; font-style:italic;">
        ${isPaid ? '🔒 Ký ức riêng tư — cần HLR để đọc đầy đủ' : preview}
      </div>
      <div style="margin-top:8px; font-size:8px; color:rgba(200,83,28,0.6); letter-spacing:0.1em;">
        ${point.lat.toFixed(4)}°N · ${point.lng.toFixed(4)}°E
      </div>
    </div>
  `;
}

export function MemoryMap({ scans, ownership, privacyMode, lotId, journalPoints = [] }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const markersRef   = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded]   = useState(false);
  const [mapError,  setMapError]    = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'1m'|'3m'|'6m'|'12m'|'all'>('all');

  // Filter journal points by time
  const filteredJournalPoints = journalPoints.filter(p => {
    if (timeFilter === 'all') return true;
    const months = timeFilter === '1m' ? 1 : timeFilter === '3m' ? 3 : timeFilter === '6m' ? 6 : 12;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return new Date(p.entry_date) >= cutoff;
  });

  const shouldShowMap = privacyMode !== 'private';
  const allScans      = shouldShowMap ? filterSmartDots(scans, privacyMode) : [];
  const displayScans  = allScans; // timeFilter applies to journal only (below)

  const uniqueCities    = new Set(displayScans.map(s => s.city).filter(Boolean)).size;
  const uniqueCountries = new Set(displayScans.map(s => s.country).filter(Boolean)).size;
  const journeyCount    = journalPoints.length;

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) { setMapError('NEXT_PUBLIC_MAPBOX_TOKEN chưa được cấu hình'); return; }

    mapboxgl.accessToken = token;
    if (!mapContainer.current || mapRef.current) return;
    if (!shouldShowMap) return;

    const scanCoords    = displayScans.map(s => getCoords(s)).filter((c): c is [number, number] => c !== null);
    const journalCoords = filteredJournalPoints.map(p => [p.lng, p.lat] as [number, number]);
    const allCoords     = [...scanCoords, ...journalCoords];

    if (allCoords.length === 0) {
      // Không có GPS → center trên Việt Nam, vẫn hiện map
      try {
        const map = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [106.0, 16.5], // Center Vietnam
          zoom: 5,
          attributionControl: false,
        });
        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('load', () => setMapLoaded(true));
      } catch {}
      return;
    }

    const bounds = allCoords.reduce(
      (acc, [lng, lat]) => ({
        minLng: Math.min(acc.minLng, lng), maxLng: Math.max(acc.maxLng, lng),
        minLat: Math.min(acc.minLat, lat), maxLat: Math.max(acc.maxLat, lat),
      }),
      { minLng: 180, maxLng: -180, minLat: 90, maxLat: -90 }
    );

    const centerLng = (bounds.minLng + bounds.maxLng) / 2;
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;

    try {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style:     'mapbox://styles/mapbox/dark-v11',
        center:    [centerLng, centerLat],
        zoom:      allCoords.length === 1 ? 10 : 3,
        attributionControl: false,
      });

      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', () => {
        setMapLoaded(true);

        if (allCoords.length > 1) {
          const lngLatBounds = new mapboxgl.LngLatBounds();
          allCoords.forEach(c => lngLatBounds.extend(c));
          map.fitBounds(lngLatBounds, { padding: 70, maxZoom: 8 });
        }

        // ── Scan event markers (existing) ───────────────────
        displayScans.forEach((scan, idx) => {
          const coord = getCoords(scan);
          if (!coord) return;
          const isLatest = idx === 0;
          const color    = getMarkerColor(scan.scan_type);

          const el  = document.createElement('div');
          el.className = 'mm-marker mm-marker--scan';

          const dot = document.createElement('div');
          dot.className = 'mm-dot';
          dot.style.cssText = `width:14px;height:14px;background:${color};border:2px solid rgba(235,230,220,0.9);border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.6);`;
          el.appendChild(dot);

          const pulse = document.createElement('div');
          pulse.className = isLatest ? 'mm-pulse mm-pulse--latest' : 'mm-pulse';
          pulse.style.cssText = `background:${color};`;
          el.appendChild(pulse);

          if (isLatest) {
            const ripple = document.createElement('div');
            ripple.className = 'mm-ripple';
            ripple.style.cssText = `border-color:${color};`;
            el.appendChild(ripple);
          }

          new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat(coord)
            .setPopup(new mapboxgl.Popup({
              offset: 20, closeButton: false, className: 'memory-map-popup',
            }).setHTML(renderPopupContent(scan)))
            .addTo(map);
        });

        // ── Journal GPS markers (NEW) ────────────────────────
        filteredJournalPoints.forEach((point, idx) => {
          const color = journalPinColor(point.entry_type);
          const isMemory = point.entry_type === 'memory';

          const el = document.createElement('div');
          el.className = 'mm-marker mm-marker--journal';
          el.setAttribute('data-journal-id', point.id);

          // Circle dot (nhất quán với scan pins)
          const dot = document.createElement('div');
          dot.className = 'mm-dot';
          dot.style.cssText = `
            width: 14px; height: 14px;
            background: ${color};
            border: 2px solid rgba(235,230,220,0.9);
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.6);
            ${isMemory ? 'border-style: dashed; opacity: 0.8;' : ''}
          `;
          el.appendChild(dot);

          // Ripple pulse
          const pulse = document.createElement('div');
          pulse.className = 'mm-pulse';
          pulse.style.cssText = `background: ${color};`;
          el.appendChild(pulse);

          // Order number badge
          const badge = document.createElement('div');
          badge.style.cssText = `
            position: absolute; top: -10px; left: 50%;
            transform: translateX(-50%);
            background: ${color};
            color: #fff;
            font-family: 'Space Mono', monospace;
            font-size: 7px; font-weight: 700;
            padding: 1px 4px;
            border-radius: 2px;
            white-space: nowrap;
            pointer-events: none;
          `;
          badge.textContent = `${idx + 1}`;
          el.appendChild(badge);

          new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([point.lng, point.lat])
            .setPopup(new mapboxgl.Popup({
              offset: 20, closeButton: false, className: 'memory-map-popup memory-map-popup--journal',
            }).setHTML(renderJournalPopup(point)))
            .addTo(map);
        });

        // ── Journey line through journal points ──────────────
        if (filteredJournalPoints.length > 1) {
          const journalLineCoords = [...filteredJournalPoints]
            .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime())
            .map(p => [p.lng, p.lat] as [number, number]);

          map.addSource('journal-line', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: journalLineCoords } },
          });
          map.addLayer({
            id: 'journal-line-layer', type: 'line', source: 'journal-line',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color':     '#C8531C',
              'line-width':     2,
              'line-opacity':   0.6,
              'line-dasharray': [3, 2],
            },
          });
        }

        // ── Scan journey line ────────────────────────────────
        const sortedScans = [...displayScans].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const scanLineCoords = sortedScans.map(s => getCoords(s)).filter((c): c is [number, number] => c !== null);

        if (scanLineCoords.length > 1) {
          map.addSource('journey-line', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: scanLineCoords } },
          });
          map.addLayer({
            id: 'journey-line-layer', type: 'line', source: 'journey-line',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color':     '#4a9eff',
              'line-width':     1.5,
              'line-opacity':   0.3,
              'line-dasharray': [2, 2],
            },
          });
        }
      });

      map.on('error', e => { setMapError(e.error?.message || 'Lỗi Mapbox'); });
    } catch (err) {
      setMapError(err instanceof Error ? err.message : 'Không khởi tạo được map');
    }

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [shouldShowMap, timeFilter]);

  if (!shouldShowMap) {
    return (
      <div className="border border-line p-8 text-center">
        <div className="font-mono text-[10px] text-concrete tracking-[0.2em] uppercase mb-2">🔒 PRIVATE MODE</div>
        <div className="font-display text-xl uppercase">Chủ sở hữu đã <span className="font-serif italic text-rust normal-case">ẩn</span> hành trình</div>
      </div>
    );
  }

  if (displayScans.length === 0 && journalPoints.length === 0) {
    return (
      <div className="border border-dashed border-line p-8 text-center">
        <div className="font-display text-3xl text-concrete mb-2">📍</div>
        <div className="font-display text-xl uppercase mb-2">Chưa có hành trình nào</div>
      </div>
    );
  }

  return (
    <div>
      {/* Stats bar + Time filter */}
      <div className="border border-line border-b-0">
        <div className="grid grid-cols-4 gap-0 border-b border-line">
          <div className="p-4 border-r border-line">
            <div className="font-mono text-[9px] text-bone-2 tracking-[0.16em] uppercase mb-1">Thành phố</div>
            <div className="font-display text-2xl text-rust">{uniqueCities}</div>
          </div>
          <div className="p-4 border-r border-line">
            <div className="font-mono text-[9px] text-bone-2 tracking-[0.16em] uppercase mb-1">Quốc gia</div>
            <div className="font-display text-2xl text-bone">{uniqueCountries}</div>
          </div>
          <div className="p-4 border-r border-line">
            <div className="font-mono text-[9px] text-bone-2 tracking-[0.16em] uppercase mb-1">Scan events</div>
            <div className="font-display text-2xl text-bone">{displayScans.length}</div>
          </div>
          <div className="p-4">
            <div className="font-mono text-[9px] text-bone-2 tracking-[0.16em] uppercase mb-1">Ký ức GPS</div>
            <div className="font-display text-2xl text-rust">{filteredJournalPoints.length}<span className="font-mono text-[9px] text-concrete">/{journeyCount}</span></div>
          </div>
        </div>

        {/* Time filter */}
        <div className="flex items-center gap-0 px-4 py-2 border-b border-line">
          <span className="font-mono text-[8px] text-concrete tracking-[0.14em] uppercase mr-3">
            Lọc ký ức:
          </span>
          {([
            { id: '1m',  label: '1 tháng' },
            { id: '3m',  label: '3 tháng' },
            { id: '6m',  label: '6 tháng' },
            { id: '12m', label: '12 tháng' },
            { id: 'all', label: 'Tất cả' },
          ] as const).map(f => (
            <button
              key={f.id}
              onClick={() => setTimeFilter(f.id)}
              className="px-3 py-1 font-mono text-[8px] tracking-[0.1em] uppercase border-r border-line last:border-r-0 transition-colors"
              style={{
                background:  timeFilter === f.id ? 'rgba(200,83,28,0.15)' : 'transparent',
                color:       timeFilter === f.id ? '#C8531C' : 'rgba(255,255,255,0.35)',
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map container */}
      <div className="relative border border-line" style={{ height: '440px' }}>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink z-10">
            <div className="text-center p-6">
              <div className="font-mono text-[10px] text-hazard tracking-[0.2em] uppercase mb-3">⚠ Lỗi Mapbox</div>
              <div className="font-body text-sm text-bone-2">{mapError}</div>
            </div>
          </div>
        )}

        {!mapLoaded && !mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-2 z-10">
            <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase animate-pulse">Đang tải bản đồ...</div>
          </div>
        )}

        {mapLoaded && (
          <div className="absolute top-4 left-4 bg-ink/90 border border-line px-3 py-2 backdrop-blur z-20">
            <div className="font-mono text-[9px] text-bone-2 tracking-[0.14em] uppercase">
              🔐 {privacyModeLabel(privacyMode)}
            </div>
          </div>
        )}

        {mapLoaded && (
          <div className="absolute bottom-4 left-4 bg-rust text-ink px-3 py-2 z-20">
            <div className="font-mono text-[9px] tracking-[0.18em] uppercase">LOT // {lotId}</div>
          </div>
        )}

        {/* Journal points count badge */}
        {mapLoaded && journeyCount > 0 && (
          <div className="absolute top-4 right-16 bg-ink/90 border border-rust/40 px-3 py-2 backdrop-blur z-20">
            <div className="font-mono text-[9px] text-rust tracking-[0.14em] uppercase">
              ◆ {journeyCount} ký ức
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="border border-t-0 border-line p-4 bg-ink-2/40">
        <div className="flex items-center gap-6 flex-wrap">
          <LegendItem color="#c8531c" label="Hub intake" shape="circle" />
          <LegendItem color="#6ec070" label="Owner check" shape="circle" />
          <LegendItem color="#4a9eff" label="Public view" shape="circle" />
          <LegendItem color="#d4a84a" label="Transfer" shape="circle" />
          <div className="w-px h-4 bg-line mx-1" />
          <LegendItem color="#C8531C" label="Checkin" shape="circle" />
          <LegendItem color="#d4af37" label="Trải nghiệm" shape="circle" />
          <LegendItem color="#5DCAA5" label="Ký ức (paid)" shape="circle" />
        </div>
      </div>

      <p className="mt-3 font-mono text-[10px] text-concrete tracking-[0.14em] uppercase italic">
        ℹ {getPrivacyDisclaimer(privacyMode)}
      </p>

      <style jsx global>{`
        .mm-marker { width: 24px; height: 24px; cursor: pointer; }
        .mm-dot {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none; will-change: transform;
        }
        .mm-pulse {
          position: absolute; top: 50%; left: 50%;
          width: 14px; height: 14px; border-radius: 50%;
          opacity: 0; pointer-events: none;
          animation: mm-pulse-anim 2.5s ease-out infinite;
          transform: translate(-50%, -50%) scale(1);
          will-change: opacity, transform;
        }
        .mm-pulse--latest { animation: mm-pulse-anim 1.8s ease-out infinite; }
        .mm-ripple {
          position: absolute; top: 50%; left: 50%;
          width: 24px; height: 24px; border: 2px solid;
          border-radius: 50%; pointer-events: none; opacity: 0;
          animation: mm-ripple-anim 2s ease-out infinite;
          transform: translate(-50%, -50%) scale(1);
          will-change: opacity, transform;
        }
        @keyframes mm-pulse-anim {
          0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.5; }
          100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; }
        }
        @keyframes mm-ripple-anim {
          0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 0.7; }
          100% { transform: translate(-50%,-50%) scale(4);   opacity: 0; }
        }
        .mm-marker--journal { width: 28px; height: 28px; }
        .mm-marker:hover .mm-dot { transform: translate(-50%,-50%) scale(1.25); transition: transform 0.15s ease; }
        .memory-map-popup .mapboxgl-popup-content {
          background: #1a1a1c; color: #ebe6dc;
          border: 1px solid #2a2a2c; padding: 12px 14px;
          font-family: var(--font-space-mono), monospace;
          font-size: 11px; border-radius: 0;
          box-shadow: 0 4px 20px rgba(0,0,0,0.6);
        }
        .memory-map-popup--journal .mapboxgl-popup-content {
          border-color: rgba(200,83,28,0.4);
          background: #1a0f0a;
        }
        .memory-map-popup .mapboxgl-popup-tip { border-top-color: #2a2a2c; }
        .mapboxgl-ctrl-top-right { top: 60px !important; }
      `}</style>
    </div>
  );
}

// ── Utility functions ─────────────────────────────────────────

function getCoords(scan: ScanEvent): [number, number] | null {
  if (scan.location_lat && scan.location_lng)
    return [Number(scan.location_lng), Number(scan.location_lat)];
  if (scan.city && CITY_COORDS[scan.city]) return CITY_COORDS[scan.city];
  return null;
}

function getMarkerColor(scanType: string): string {
  switch (scanType) {
    case 'hub_intake':        return '#c8531c';
    case 'owner_check':       return '#6ec070';
    case 'public_view':       return '#4a9eff';
    case 'transfer_buyer':    return '#d4a84a';
    case 'lost_found_finder': return '#dc4a4a';
    default: return '#8a8a80';
  }
}

function renderPopupContent(scan: ScanEvent): string {
  const date = new Date(scan.created_at).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
  const label: Record<string, string> = {
    hub_intake: 'Hub nhận', owner_check: 'Chủ kiểm tra',
    public_view: 'Ai đó quét', transfer_buyer: 'Chuyển buyer',
    lost_found_finder: 'Người nhặt tìm thấy',
  };
  return `
    <div style="min-width:180px;">
      <div style="color:#c8531c;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:4px;">
        ${label[scan.scan_type] || scan.scan_type}
      </div>
      <div style="font-family:Arial,sans-serif;font-size:15px;font-weight:900;text-transform:uppercase;margin-bottom:6px;">
        ${scan.city || 'Unknown'}
      </div>
      <div style="color:#a8a89d;font-size:10px;">${scan.country || 'VN'} · ${date}</div>
    </div>`;
}

function privacyModeLabel(mode: string): string {
  const map: Record<string, string> = {
    public_precise: 'PUBLIC · PRECISE', public_city: 'PUBLIC · CITY-LEVEL',
    friends: 'FRIENDS ONLY', private: 'PRIVATE',
  };
  return map[mode] ?? mode.toUpperCase();
}

function getPrivacyDisclaimer(mode: string): string {
  const map: Record<string, string> = {
    public_city:    'Chỉ hiển thị tên thành phố.',
    public_precise: 'Chủ đã cho phép hiển thị địa chỉ chính xác.',
    friends:        'Chỉ bạn bè của chủ mới xem được map này.',
  };
  return map[mode] ?? 'Dữ liệu vị trí được ẩn danh và chỉ giữ trong 30 ngày nếu scan từ public.';
}

function filterSmartDots(scans: ScanEvent[], privacyMode: string): ScanEvent[] {
  if (scans.length <= 30) return scans;
  const sorted = [...scans].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const result: ScanEvent[] = [sorted[0]];
  const seenCities = new Set<string>(sorted[0].city ? [sorted[0].city] : []);
  for (const scan of sorted.slice(1, -1)) {
    if (result.length >= 28) break;
    if (scan.city && !seenCities.has(scan.city)) { result.push(scan); seenCities.add(scan.city); }
  }
  for (const scan of sorted.slice(1, -1)) {
    if (result.length >= 29) break;
    if (!result.includes(scan) && (scan.scan_type === 'hub_intake' || scan.scan_type === 'transfer_buyer'))
      result.push(scan);
  }
  if (sorted.length > 1) result.push(sorted[sorted.length - 1]);
  return result;
}

function LegendItem({ color, label, shape = 'circle' }: { color: string; label: string; shape?: 'circle' | 'diamond' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full border border-bone/50" style={{ background: color }} />
      <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-bone-2">{label}</span>
    </div>
  );
}
