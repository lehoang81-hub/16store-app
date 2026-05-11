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

interface Props {
  scans: ScanEvent[];
  qrCode: string;
  height?: number;
}

const CITY_COORDS: Record<string, [number, number]> = {
  'Hà Nội': [105.8542, 21.0285],
  'HCM': [106.6602, 10.7626],
  'Đà Nẵng': [108.2022, 16.0544],
  'Hải Phòng': [106.6881, 20.8449],
  'Cần Thơ': [105.7469, 10.0452],
  'Nha Trang': [109.1967, 12.2388],
  'Đà Lạt': [108.4583, 11.9404],
  'Hội An': [108.3380, 15.8800],
  'Huế': [107.5909, 16.4637],
  'Vũng Tàu': [107.1364, 10.4114],
  'Phú Quốc': [103.9678, 10.2870],
  'Bangkok': [100.5018, 13.7563],
  'Singapore': [103.8198, 1.3521],
  'Tokyo': [139.6503, 35.6762],
  'Seoul': [126.9780, 37.5665],
  'Hong Kong': [114.1694, 22.3193],
};

/**
 * Mini version of MemoryMap cho embed vào lot page.
 * - Height mặc định 260px (không phải 500px như full)
 * - Không có popup (simple, stripped down)
 * - Click cả map → redirect tới /passport/[qrCode]
 * - Có dots + dashed line, không có legend
 */
export function MemoryMapMini({ scans, qrCode, height = 260 }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const uniqueCities = new Set(scans.map((s) => s.city).filter(Boolean)).size;
  const uniqueCountries = new Set(scans.map((s) => s.country).filter(Boolean)).size;

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || !mapContainer.current || mapRef.current) return;
    if (scans.length === 0) return;

    mapboxgl.accessToken = token;

    const coords = scans
      .map((s) => getCoords(s))
      .filter((c): c is [number, number] => c !== null);

    if (coords.length === 0) return;

    const bounds = coords.reduce(
      (acc, [lng, lat]) => ({
        minLng: Math.min(acc.minLng, lng),
        maxLng: Math.max(acc.maxLng, lng),
        minLat: Math.min(acc.minLat, lat),
        maxLat: Math.max(acc.maxLat, lat),
      }),
      { minLng: 180, maxLng: -180, minLat: 90, maxLat: -90 }
    );

    const centerLng = (bounds.minLng + bounds.maxLng) / 2;
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;

    try {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [centerLng, centerLat],
        zoom: coords.length === 1 ? 9 : 3,
        attributionControl: false,
        interactive: false, // Mini map không zoom/pan
      });

      mapRef.current = map;

      map.on('load', () => {
        setMapLoaded(true);

        if (coords.length > 1) {
          const lngLatBounds = new mapboxgl.LngLatBounds();
          coords.forEach((c) => lngLatBounds.extend(c));
          map.fitBounds(lngLatBounds, { padding: 30, maxZoom: 6 });
        }

        // Markers (nhỏ hơn, không ripple)
        scans.forEach((scan) => {
          const coord = getCoords(scan);
          if (!coord) return;

          const el = document.createElement('div');
          el.style.cssText = `
            width: 12px;
            height: 12px;
            background: ${getMarkerColor(scan.scan_type)};
            border: 1.5px solid #ebe6dc;
            border-radius: 50%;
            box-shadow: 0 1px 4px rgba(0,0,0,0.5);
          `;

          new mapboxgl.Marker(el).setLngLat(coord).addTo(map);
        });

        // Dashed line
        const sortedByDate = [...scans].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const lineCoords = sortedByDate
          .map((s) => getCoords(s))
          .filter((c): c is [number, number] => c !== null);

        if (lineCoords.length > 1) {
          map.addSource('mini-journey-line', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: lineCoords },
            },
          });
          map.addLayer({
            id: 'mini-journey-line-layer',
            type: 'line',
            source: 'mini-journey-line',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#c8531c',
              'line-width': 1.5,
              'line-opacity': 0.5,
              'line-dasharray': [2, 2],
            },
          });
        }
      });
    } catch (err) {
      console.error('[MemoryMapMini] init error:', err);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [scans]);

  if (scans.length === 0 || !process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return null;
  }

  return (
    <div className="border border-line">
      {/* Stats bar mini */}
      <div className="p-3 border-b border-line bg-ink-2/40 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <span className="font-mono text-[9px] text-bone-2 tracking-[0.16em] uppercase">Thành phố </span>
            <span className="font-display text-base text-rust">{uniqueCities}</span>
          </div>
          <div>
            <span className="font-mono text-[9px] text-bone-2 tracking-[0.16em] uppercase">Quốc gia </span>
            <span className="font-display text-base text-bone">{uniqueCountries}</span>
          </div>
        </div>
        <a
          href={`/passport/${qrCode}`}
          className="font-mono text-[10px] text-rust tracking-[0.18em] uppercase hover:text-bone transition-colors"
        >
          Xem đầy đủ →
        </a>
      </div>

      {/* Map */}
      <div style={{ width: '100%', height: `${height}px`, position: 'relative' }}>
        <div
          ref={mapContainer}
          style={{ width: '100%', height: '100%', position: 'relative' }}
        />

        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-2 pointer-events-none">
            <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase animate-pulse">
              Đang tải map...
            </div>
          </div>
        )}

        {/* Overlay link để click vào map redirect sang full passport */}
        {mapLoaded && (
          <a
            href={`/passport/${qrCode}`}
            className="absolute inset-0 z-10 flex items-center justify-center opacity-0 hover:opacity-100 hover:bg-ink/60 transition-opacity"
          >
            <div className="border border-rust bg-rust text-ink px-5 py-2 font-mono text-[11px] tracking-[0.2em] uppercase">
              🗺 Xem hành trình đầy đủ
            </div>
          </a>
        )}
      </div>
    </div>
  );
}

function getCoords(scan: ScanEvent): [number, number] | null {
  if (scan.location_lat && scan.location_lng) {
    return [Number(scan.location_lng), Number(scan.location_lat)];
  }
  if (scan.city && CITY_COORDS[scan.city]) {
    return CITY_COORDS[scan.city];
  }
  return null;
}

function getMarkerColor(scanType: string): string {
  switch (scanType) {
    case 'hub_intake': return '#c8531c';
    case 'owner_check': return '#6ec070';
    case 'public_view': return '#4a9eff';
    case 'transfer_buyer': return '#d4a84a';
    case 'lost_found_finder': return '#dc4a4a';
    default: return '#8a8a80';
  }
}
