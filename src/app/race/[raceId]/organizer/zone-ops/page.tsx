'use client';
// =============================================================
// /race/[raceId]/organizer/zone-ops/page.tsx
// Zone Operations — vẽ polygon, quản lý TNV, inventory, transport
// Client component vì cần Mapbox GL
// =============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  RaceZone, ZoneWithStats, EventStaff, ZoneInventory,
  TransportRequest, ZonePolygonPoint,
} from '@/lib/race/types';

// ── CONSTANTS ─────────────────────────────────────────────────
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

async function sbFetch<T>(table: string, params = ''): Promise<T[]> {
  const res = await fetch(
    `${SB_URL}/rest/v1/${table}${params ? '?' + params : ''}`,
    { headers: { ...H, 'Accept-Profile': 'hlrace' } }
  );
  return res.ok ? res.json() : [];
}

// ── TYPES ─────────────────────────────────────────────────────
type Tab = 'overview' | 'inventory' | 'transport' | 'checklist';

interface PageProps {
  params: Promise<{ raceId: string }>;
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function ZoneOpsPage({ params }: PageProps) {
  const [raceId, setRaceId] = useState<string>('');
  const [tab, setTab] = useState<Tab>('overview');
  const [zones, setZones] = useState<RaceZone[]>([]);
  const [staff, setStaff] = useState<EventStaff[]>([]);
  const [inventory, setInventory] = useState<ZoneInventory[]>([]);
  const [transport, setTransport] = useState<TransportRequest[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawMode, setDrawMode] = useState(false);

  useEffect(() => {
    params.then(p => { setRaceId(p.raceId); });
  }, [params]);

  const loadAll = useCallback(async () => {
    if (!raceId) return;
    setLoading(true);
    const [z, s, inv, tr] = await Promise.all([
      sbFetch<RaceZone>('race_zones', `race_id=eq.${raceId}&deleted_at=is.null&order=zone_code.asc`),
      sbFetch<EventStaff>('event_staff', `race_id=eq.${raceId}&deleted_at=is.null`),
      sbFetch<ZoneInventory>('zone_inventory', `race_id=eq.${raceId}&deleted_at=is.null`),
      sbFetch<TransportRequest>('transport_requests', `race_id=eq.${raceId}&deleted_at=is.null&order=pickup_time.asc`),
    ]);
    setZones(z); setStaff(s); setInventory(inv); setTransport(tr);
    setLoading(false);
  }, [raceId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Derived: zones with stats
  const zonesWithStats: ZoneWithStats[] = zones.map(z => {
    const zStaff = staff.filter(s => s.zone_id === z.zone_id);
    const zInv   = inventory.filter(i => i.zone_id === z.zone_id);
    return {
      ...z,
      staff: zStaff,
      staff_on_duty:        zStaff.filter(s => s.status === 'on_duty').length,
      staff_checked_in:     zStaff.filter(s => s.checkin_at !== null).length,
      staff_need_transport: zStaff.filter(s => s.transport_need !== 'self').length,
      inventory: zInv,
      low_stock_count: zInv.filter(i =>
        i.qty_received > 0 &&
        (i.qty_current / i.qty_received * 100) < i.alert_threshold
      ).length,
      active_alerts: [],
    };
  });

  const unassigned = staff.filter(s => !s.zone_id);
  const pendingTransport = transport.filter(t => t.status === 'pending');
  const lowStock = inventory.filter(i =>
    i.qty_received > 0 &&
    (i.qty_current / i.qty_received * 100) < i.alert_threshold
  );

  if (loading) return <LoadingState />;

  return (
    <div className="flex h-screen bg-[var(--hl-bg)] overflow-hidden">
      {/* LEFT: Zone Map */}
      <div className="flex-1 relative">
        <ZoneMapPanel
          raceId={raceId}
          zones={zones}
          staff={staff}
          selectedZone={selectedZone}
          onSelectZone={setSelectedZone}
          drawMode={drawMode}
          onDrawModeChange={setDrawMode}
          onZoneCreated={loadAll}
        />
      </div>

      {/* RIGHT: Control Panel */}
      <div className="w-[380px] flex-shrink-0 bg-[var(--hl-surface)] border-l border-[var(--hl-border)] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--hl-border)]">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[10px] font-bold tracking-[2px] uppercase text-[var(--hl-accent)]">
              🏗️ Zone Operations
            </span>
            {pendingTransport.length > 0 && (
              <span className="bg-[var(--hl-warn)]/20 text-[var(--hl-warn)] text-[9px] font-bold px-2 py-0.5 rounded-full">
                {pendingTransport.length} xe chờ phân
              </span>
            )}
            {lowStock.length > 0 && (
              <span className="bg-[var(--hl-red)]/20 text-[var(--hl-red)] text-[9px] font-bold px-2 py-0.5 rounded-full">
                {lowStock.length} vật tư thiếu
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {([
              ['overview',   '🏗️', 'Zones'],
              ['inventory',  '📦', 'Vật tư'],
              ['transport',  '🚗', 'Đưa đón'],
              ['checklist',  '✅', 'Cuối ca'],
            ] as [Tab, string, string][]).map(([key, icon, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                  tab === key
                    ? 'bg-[var(--hl-accent)]/10 text-[var(--hl-accent)] border-[var(--hl-accent)]/40'
                    : 'text-[var(--hl-muted)] border-transparent hover:text-[var(--hl-text)] hover:bg-white/5'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3
          [scrollbar-width:thin] [scrollbar-color:var(--hl-border)_transparent]">
          {tab === 'overview'   && <ZoneOverviewTab zones={zonesWithStats} unassigned={unassigned} selectedZone={selectedZone} onSelect={setSelectedZone} onRefresh={loadAll} raceId={raceId} />}
          {tab === 'inventory'  && <InventoryTab inventory={inventory} zones={zones} lowStock={lowStock} raceId={raceId} onRefresh={loadAll} />}
          {tab === 'transport'  && <TransportTab transport={transport} zones={zones} raceId={raceId} onRefresh={loadAll} />}
          {tab === 'checklist'  && <ChecklistTab zones={zones} raceId={raceId} />}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--hl-border)]">
          <button
            onClick={loadAll}
            className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--hl-muted)] text-[11px] font-bold transition-all"
          >
            🔄 Làm mới dữ liệu
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAP PANEL ─────────────────────────────────────────────────
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
const MAP_CENTER: [number, number] = [105.9080, 20.5350];
const CLUSTER_COLOR: Record<string, string> = {
  safety: '#ef4444', media: '#3b82f6', protocol: '#f59e0b', logistics: '#10b981',
};

type MapboxMap = {
  remove: () => void; isStyleLoaded: () => boolean;
  on: (e: string, h: (ev: unknown) => void) => void;
  off: (e: string, h: (ev: unknown) => void) => void;
  addSource: (id: string, src: object) => void;
  getSource: (id: string) => unknown;
  addLayer: (layer: object) => void;
  getLayer: (id: string) => unknown;
  removeLayer: (id: string) => void;
  removeSource: (id: string) => void;
  flyTo: (opts: object) => void;
};

function ZoneMapPanel({ raceId, zones, staff, selectedZone, onSelectZone, drawMode, onDrawModeChange, onZoneCreated }: {
  raceId: string; zones: RaceZone[]; staff: EventStaff[];
  selectedZone: string | null; onSelectZone: (id: string | null) => void;
  drawMode: boolean; onDrawModeChange: (v: boolean) => void; onZoneCreated: () => void;
}) {
  const mapRef      = useRef<HTMLDivElement>(null);
  const map         = useRef<MapboxMap | null>(null);
  const markers     = useRef<{ remove: () => void }[]>([]);
  const drawPoints  = useRef<ZonePolygonPoint[]>([]);
  const drawDots    = useRef<{ remove: () => void }[]>([]);
  const hasPrevSrc  = useRef(false);

  const [showForm, setShowForm]     = useState(false);
  const [pendingPoly, setPendingPoly] = useState<ZonePolygonPoint[] | null>(null);
  const [zoneName, setZoneName]     = useState('');
  const [zoneCode, setZoneCode]     = useState('');
  const [zoneType, setZoneType]     = useState<RaceZone['zone_type']>('general');
  const [zoneColor, setZoneColor]   = useState('#f97316');
  const [saving, setSaving]         = useState(false);

  // Init map
  useEffect(() => {
    if (!mapRef.current || map.current) return;
    let cancelled = false;
    import('mapbox-gl').then(({ default: mgl }) => {
      if (cancelled || !mapRef.current) return;
      mgl.accessToken = MAPBOX_TOKEN;
      const m = new mgl.Map({
        container: mapRef.current, zoom: 13,
        center: MAP_CENTER,
        style: 'mapbox://styles/mapbox/dark-v11',
        attributionControl: false,
      }) as unknown as MapboxMap;
      m.on('load', () => {
        if (cancelled) return;
        addZoneLayers(m);
        renderZonePolygons(m, zones);
        syncStaffMarkers(m, staff, markers, mgl as any);
      });
      map.current = m;
    });
    return () => { cancelled = true; if (map.current) { map.current.remove(); map.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync zones
  useEffect(() => {
    const m = map.current; if (!m?.isStyleLoaded()) return;
    renderZonePolygons(m, zones);
  }, [zones]);

  // Sync staff markers
  useEffect(() => {
    const m = map.current; if (!m?.isStyleLoaded()) return;
    import('mapbox-gl').then(({ default: mgl }) => {
      markers.current.forEach(mk => mk.remove()); markers.current = [];
      syncStaffMarkers(m, staff, markers, mgl as any);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff]);

  const clickHandler = useCallback((e: unknown) => {
    const ev = e as { lngLat: { lat: number; lng: number } };
    const pt = { lat: ev.lngLat.lat, lng: ev.lngLat.lng };
    drawPoints.current.push(pt);
    import('mapbox-gl').then(({ default: mgl }) => {
      const el = document.createElement('div');
      el.style.cssText = 'width:10px;height:10px;border-radius:50%;background:#f97316;border:2px solid #fff;box-shadow:0 0 6px rgba(249,115,22,.8)';
      const mk = new mgl.Marker({ element: el }).setLngLat([pt.lng, pt.lat]).addTo(map.current as any);
      drawDots.current.push(mk as unknown as { remove: () => void });
    });
    updateDrawPreview(map.current!, drawPoints.current, hasPrevSrc.current);
    hasPrevSrc.current = true;
  }, []);

  const dblClickHandler = useCallback((e: unknown) => {
    void e;
    const pts = [...drawPoints.current];
    if (pts.length >= 3) {
      drawDots.current.forEach(mk => mk.remove()); drawDots.current = [];
      clearDrawPreview(map.current!);
      drawPoints.current = []; hasPrevSrc.current = false;
      setPendingPoly(pts); setShowForm(true);
    }
    map.current?.off('click', clickHandler);
    map.current?.off('dblclick', dblClickHandler);
    onDrawModeChange(false);
  }, [clickHandler, onDrawModeChange]);

  const startDraw = useCallback(() => {
    if (!map.current) return;
    drawPoints.current = []; drawDots.current = []; hasPrevSrc.current = false;
    onDrawModeChange(true);
    map.current.on('click', clickHandler);
    map.current.on('dblclick', dblClickHandler);
  }, [clickHandler, dblClickHandler, onDrawModeChange]);

  const cancelDraw = useCallback(() => {
    map.current?.off('click', clickHandler);
    map.current?.off('dblclick', dblClickHandler);
    drawDots.current.forEach(mk => mk.remove()); drawDots.current = [];
    if (map.current) clearDrawPreview(map.current);
    drawPoints.current = []; hasPrevSrc.current = false;
    onDrawModeChange(false);
  }, [clickHandler, dblClickHandler, onDrawModeChange]);

  const saveZone = async () => {
    if (!zoneName || !zoneCode || !pendingPoly) return;
    setSaving(true);
    const center = calcCenter(pendingPoly);
    const now = new Date().toISOString();
    try {
      await fetch(`${SB_URL}/rest/v1/race_zones`, {
        method: 'POST',
        headers: { ...H, 'Content-Type': 'application/json', 'Content-Profile': 'hlrace', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ race_id: raceId, zone_code: zoneCode, name: zoneName, zone_type: zoneType,
          polygon: pendingPoly, center_lat: center.lat, center_lng: center.lng,
          display_color: zoneColor, display_icon: getZoneIcon(zoneType), created_at: now, updated_at: now }),
      });
      setShowForm(false); setPendingPoly(null); setZoneName(''); setZoneCode('');
      onZoneCreated();
      if (map.current) map.current.flyTo({ center: [center.lng, center.lat], zoom: 15 });
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* Toolbar */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
        <button onClick={drawMode ? cancelDraw : startDraw}
          className={`px-4 py-2 rounded-xl text-[11px] font-bold shadow-xl backdrop-blur-md transition-all border ${
            drawMode ? 'bg-red-500/90 text-white border-red-400/50 animate-pulse'
              : 'bg-[#111827]/90 text-orange-400 border-orange-500/30 hover:border-orange-400/60'}`}>
          {drawMode ? '⏹ Hủy vẽ' : '✏️ Vẽ Zone mới'}
        </button>
        {drawMode && (
          <div className="px-3 py-2 rounded-xl bg-black/80 backdrop-blur-sm text-[10px] font-bold text-yellow-300 border border-yellow-500/20">
            📍 Click thêm điểm · ✅ Double-click hoàn thành
          </div>
        )}
        {zones.length > 0 && !drawMode && (
          <div className="bg-black/75 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
            {zones.map(z => (
              <button key={z.zone_id}
                onClick={() => { onSelectZone(z.zone_id); if (z.center_lat && z.center_lng) map.current?.flyTo({ center: [z.center_lng, z.center_lat], zoom: 15 }); }}
                className={`flex items-center gap-2 w-full py-1 text-[10px] rounded transition-colors ${selectedZone === z.zone_id ? 'text-white' : 'text-white/60 hover:text-white/90'}`}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: z.display_color }} />
                <span className="font-bold" style={{ color: z.display_color }}>{z.zone_code}</span>
                <span className="truncate">{z.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Staff badge */}
      <div className="absolute top-4 right-4 bg-black/75 backdrop-blur-sm rounded-xl px-3 py-2 text-[10px] font-bold border border-white/10 z-10 space-y-1">
        <div className="flex items-center gap-2 text-white/70">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {staff.filter(s => s.status === 'on_duty').length} đang trực
        </div>
        <div className="flex items-center gap-2 text-white/50">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          {staff.filter(s => s.location_coords).length} có GPS
        </div>
      </div>

      {/* New Zone Form */}
      {showForm && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20 p-4">
          <div className="bg-[#0f172a] border border-orange-500/30 rounded-2xl p-6 w-[360px] shadow-2xl">
            <div className="text-[11px] font-black tracking-[2px] uppercase text-orange-400 mb-1">✏️ Tạo Zone mới</div>
            <div className="text-[10px] text-white/40 mb-5">
              Polygon {pendingPoly?.length} điểm · Tâm {calcCenter(pendingPoly ?? []).lat.toFixed(4)}, {calcCenter(pendingPoly ?? []).lng.toFixed(4)}
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-[72px_1fr] gap-2">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-white/40 mb-1.5">Mã</div>
                  <input value={zoneCode} onChange={e => setZoneCode(e.target.value.toUpperCase())} placeholder="Z1"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-[13px] font-black font-mono text-orange-400 focus:outline-none focus:border-orange-500/50" />
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-white/40 mb-1.5">Tên zone</div>
                  <input value={zoneName} onChange={e => setZoneName(e.target.value)} placeholder="Khu Start/Finish"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-[12px] text-white focus:outline-none focus:border-orange-500/50" />
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-white/40 mb-1.5">Loại zone</div>
                <select value={zoneType} onChange={e => setZoneType(e.target.value as RaceZone['zone_type'])}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-[12px] text-white focus:outline-none focus:border-orange-500/50">
                  {([[ 'start_finish','🏁 Start/Finish'],['expo','🎪 Expo & BIB'],['parking','🅿️ Bãi xe'],['recovery','💆 Hồi phục'],['medical','🏥 Y tế'],['checkpoint','📍 Checkpoint'],['water_station','💧 Trạm nước'],['vip','👑 VIP'],['general','📌 Khác']] as [string,string][]).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-white/40 mb-1.5">Màu hiển thị</div>
                <div className="flex gap-2.5">
                  {['#10b981','#3b82f6','#f97316','#ef4444','#8b5cf6','#f59e0b','#ec4899','#64748b'].map(c => (
                    <button key={c} onClick={() => setZoneColor(c)}
                      className={`w-8 h-8 rounded-full transition-all ${zoneColor === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#0f172a]' : 'opacity-60 hover:opacity-100'}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => { setShowForm(false); setPendingPoly(null); }}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-[11px] text-white/50 hover:text-white/80 transition-colors">Hủy</button>
              <button onClick={saveZone} disabled={saving || !zoneName || !zoneCode}
                className="flex-1 py-2.5 rounded-xl text-[11px] font-bold text-white transition-all disabled:opacity-40 hover:brightness-110"
                style={{ background: zoneColor }}>
                {saving ? '⏳ Đang lưu...' : '✅ Tạo Zone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAPBOX RENDERING HELPERS ──────────────────────────────────

function addZoneLayers(m: MapboxMap) {
  try {
    m.addSource('zones', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    m.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones',
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.12 } });
    m.addLayer({ id: 'zones-outline', type: 'line', source: 'zones',
      paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0.8, 'line-dasharray': [2, 1] } });
    m.addLayer({ id: 'zones-label', type: 'symbol', source: 'zones',
      layout: { 'text-field': ['concat', ['get', 'code'], ' ', ['get', 'name']], 'text-size': 11,
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'], 'text-anchor': 'center' },
      paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#000', 'text-halo-width': 1.5 } });
  } catch (e) { console.warn('addZoneLayers:', e); }
}

function renderZonePolygons(m: MapboxMap, zones: RaceZone[]) {
  const src = m.getSource('zones') as { setData: (d: object) => void } | null;
  if (!src) return;
  const features = zones.filter(z => z.polygon && z.polygon.length >= 3).map(z => ({
    type: 'Feature',
    properties: { id: z.zone_id, code: z.zone_code, name: z.name, color: z.display_color },
    geometry: {
      type: 'Polygon',
      coordinates: [[ ...(z.polygon ?? []).map((p: ZonePolygonPoint) => [p.lng, p.lat]),
        [(z.polygon ?? [])[0]?.lng, (z.polygon ?? [])[0]?.lat] ]],
    },
  }));
  src.setData({ type: 'FeatureCollection', features });
}

type MglLib = { Marker: new (opts: object) => { setLngLat: (c: [number,number]) => object; setPopup: (p: object) => object; addTo: (m: object) => { remove: () => void }; remove: () => void }; Popup: new (opts: object) => object };

function syncStaffMarkers(m: MapboxMap, staff: EventStaff[], mkRef: React.MutableRefObject<{ remove: () => void }[]>, mgl: MglLib) {
  staff.forEach(s => {
    if (!s.location_coords) return;
    const [latStr, lngStr] = s.location_coords.split(',');
    const lat = parseFloat(latStr), lng = parseFloat(lngStr);
    if (isNaN(lat) || isNaN(lng)) return;
    const color = CLUSTER_COLOR[s.cluster] ?? '#64748b';
    const isOn = s.status === 'on_duty';
    const el = document.createElement('div');
    el.innerHTML = `<div style="position:relative;width:32px;height:32px">
      ${isOn ? `<div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid ${color};opacity:.4;animation:pulse-ring 1.5s ease-out infinite"></div>` : ''}
      <div style="width:32px;height:32px;border-radius:50%;background:${color};border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.5);cursor:pointer">
        ${s.cluster==='safety'?'🦺':s.cluster==='media'?'📸':s.cluster==='protocol'?'👑':'🔧'}
      </div>
      ${s.position_code?`<div style="position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);background:${color};color:#fff;font-size:7px;font-weight:900;padding:1px 4px;border-radius:3px;white-space:nowrap;font-family:monospace">${s.position_code}</div>`:''}
    </div>`;
    const popup = new (mgl as any).Popup({ offset: 20, closeButton: false }).setHTML(`
      <div style="font-family:system-ui;padding:4px 2px;min-width:140px">
        <div style="font-weight:800;font-size:13px;margin-bottom:3px">${s.full_name}</div>
        <div style="font-size:10px;color:#64748b;margin-bottom:5px">
          <span style="background:${color}22;color:${color};padding:1px 6px;border-radius:8px;font-weight:700">${s.role}</span>
          ${s.position_code?`<span style="margin-left:4px;font-family:monospace">${s.position_code}</span>`:''}
        </div>
        ${s.location_name?`<div style="font-size:10px;margin-bottom:3px">📍 ${s.location_name}</div>`:''}
        ${s.notes?`<div style="font-size:10px;color:#94a3b8;font-style:italic">${s.notes}</div>`:''}
        ${s.phone?`<a href="tel:${s.phone}" style="display:inline-block;margin-top:5px;background:#2563eb;color:#fff;padding:2px 10px;border-radius:6px;text-decoration:none;font-size:10px">📞 ${s.phone}</a>`:''}
      </div>`);
    const mk = new (mgl as any).Marker({ element: el }).setLngLat([lng, lat]).setPopup(popup as object).addTo(m as unknown as object);
    mkRef.current.push(mk as unknown as { remove: () => void });
  });
}

function updateDrawPreview(m: MapboxMap, pts: ZonePolygonPoint[], srcExists: boolean) {
  if (pts.length < 2) return;
  const coords = [...pts, pts[0]].map(p => [p.lng, p.lat]);
  try {
    if (srcExists) {
      (m.getSource('draw-preview') as { setData: (d: object) => void } | null)
        ?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} });
    } else {
      m.addSource('draw-preview', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} } });
      m.addLayer({ id: 'draw-preview-line', type: 'line', source: 'draw-preview',
        paint: { 'line-color': '#f97316', 'line-width': 2, 'line-dasharray': [2, 1] } });
    }
  } catch (e) { console.warn(e); }
}

function clearDrawPreview(m: MapboxMap) {
  try {
    if (m.getLayer('draw-preview-line')) m.removeLayer('draw-preview-line');
    if (m.getSource('draw-preview')) m.removeSource('draw-preview');
  } catch (e) { void e; }
}

// ── ZONE OVERVIEW TAB ─────────────────────────────────────────
function ZoneOverviewTab({ zones, unassigned, selectedZone, onSelect, onRefresh, raceId }: {
  zones: ZoneWithStats[];
  unassigned: EventStaff[];
  selectedZone: string | null;
  onSelect: (id: string | null) => void;
  onRefresh: () => void;
  raceId: string;
}) {
  return (
    <>
      {zones.map(z => (
        <div
          key={z.zone_id}
          onClick={() => onSelect(selectedZone === z.zone_id ? null : z.zone_id)}
          className={`rounded-xl border cursor-pointer transition-all p-4 ${
            selectedZone === z.zone_id
              ? 'border-[var(--hl-accent)] bg-[var(--hl-accent)]/5'
              : 'border-[var(--hl-border)] bg-[var(--hl-card,#1a2235)] hover:border-white/20'
          }`}
          style={{ borderLeftWidth: '4px', borderLeftColor: z.display_color }}
        >
          {/* Zone header */}
          <div className="flex items-start gap-3 mb-3">
            <span className="text-xl">{z.display_icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className="text-[9px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: `${z.display_color}22`, color: z.display_color }}
                >
                  {z.zone_code}
                </span>
                <span className="text-[13px] font-bold truncate">{z.name}</span>
              </div>
              {z.lead_name ? (
                <div className="text-[10px] text-[var(--hl-muted)]">
                  👑 <strong className="text-[var(--hl-text)]">{z.lead_name}</strong>
                  {z.lead_phone && <span> · {z.lead_phone}</span>}
                </div>
              ) : (
                <div className="text-[10px] text-[var(--hl-red)]">⚠️ Chưa có Zone Lead</div>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-1.5">
            <MiniStat icon="👥" label="TNV" value={z.staff.length} color="var(--hl-text)" />
            <MiniStat icon="✅" label="Check-in" value={z.staff_checked_in}
              color={z.staff_checked_in === z.staff.length && z.staff.length > 0 ? 'var(--hl-green)' : 'var(--hl-warn)'} />
            <MiniStat icon="⚡" label="Đang trực" value={z.staff_on_duty}
              color={z.staff_on_duty > 0 ? 'var(--hl-green)' : 'var(--hl-muted)'} />
            <MiniStat icon="📦" label="Kho" value={z.low_stock_count > 0 ? `${z.low_stock_count}⚠️` : 'OK'}
              color={z.low_stock_count > 0 ? 'var(--hl-red)' : 'var(--hl-green)'} />
          </div>

          {/* Staff list khi selected */}
          {selectedZone === z.zone_id && z.staff.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--hl-border)] space-y-2">
              {z.staff.map(s => (
                <StaffRow key={s.staff_id} staff={s} />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Unassigned */}
      {unassigned.length > 0 && (
        <div className="mt-2">
          <div className="text-[9px] font-bold tracking-[2px] uppercase text-[var(--hl-warn)] mb-2">
            ⚠️ Chưa phân zone ({unassigned.length})
          </div>
          {unassigned.map(s => (
            <div key={s.staff_id}
              className="flex items-center gap-3 p-3 bg-[var(--hl-warn)]/5 border border-[var(--hl-warn)]/20 rounded-lg mb-2">
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold">{s.full_name}</div>
                <div className="text-[10px] text-[var(--hl-muted)]">{s.role}</div>
              </div>
              <AssignZoneButton staffId={s.staff_id} raceId={raceId} onDone={onRefresh} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── INVENTORY TAB ─────────────────────────────────────────────
function InventoryTab({ inventory, zones, lowStock, raceId, onRefresh }: {
  inventory: ZoneInventory[];
  zones: RaceZone[];
  lowStock: ZoneInventory[];
  raceId: string;
  onRefresh: () => void;
}) {
  const zoneMap = new Map(zones.map(z => [z.zone_id, z]));

  return (
    <>
      {lowStock.length > 0 && (
        <div className="bg-[var(--hl-red)]/8 border border-[var(--hl-red)]/25 rounded-xl p-3 mb-1">
          <div className="text-[10px] font-bold text-[var(--hl-red)] mb-2">
            🚨 {lowStock.length} mặt hàng dưới ngưỡng
          </div>
          {lowStock.map(i => {
            const zone = zoneMap.get(i.zone_id ?? '');
            const pct = Math.round(i.qty_current / Math.max(i.qty_received, 1) * 100);
            return (
              <div key={i.inv_id} className="flex justify-between text-[10px] py-1 border-b border-white/5 last:border-0">
                <span className="text-[var(--hl-muted)]">
                  <span style={{ color: zone?.display_color }}>{zone?.zone_code}</span> — {i.item_name}
                </span>
                <span className="text-[var(--hl-red)] font-bold">{i.qty_current}/{i.qty_received} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Grouped by zone */}
      {zones.map(z => {
        const zInv = inventory.filter(i => i.zone_id === z.zone_id);
        if (!zInv.length) return null;
        return (
          <div key={z.zone_id} className="bg-[var(--hl-card,#1a2235)] border border-[var(--hl-border)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span>{z.display_icon}</span>
              <span className="text-[11px] font-bold">{z.name}</span>
              <span className="text-[9px] font-bold ml-auto"
                style={{ color: z.display_color }}>{z.zone_code}</span>
            </div>
            <div className="space-y-2">
              {zInv.map(i => (
                <InventoryRow key={i.inv_id} item={i} raceId={raceId} onRefresh={onRefresh} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── TRANSPORT TAB ─────────────────────────────────────────────
function TransportTab({ transport, zones, raceId, onRefresh }: {
  transport: TransportRequest[];
  zones: RaceZone[];
  raceId: string;
  onRefresh: () => void;
}) {
  const zoneMap = new Map(zones.map(z => [z.zone_id, z]));
  const groups = {
    pending:   transport.filter(t => t.status === 'pending'),
    assigned:  transport.filter(t => t.status === 'assigned'),
    completed: transport.filter(t => t.status === 'completed'),
  };

  return (
    <>
      {Object.entries(groups).map(([status, items]) => {
        if (!items.length) return null;
        const colors: Record<string, string> = {
          pending: 'var(--hl-warn)', assigned: 'var(--hl-blue)', completed: 'var(--hl-green)'
        };
        const labels: Record<string, string> = {
          pending: '🕐 Chờ phân xe', assigned: '🚗 Đã phân xe', completed: '✅ Hoàn thành'
        };
        return (
          <div key={status}>
            <div className="text-[9px] font-bold tracking-[2px] uppercase mb-2"
              style={{ color: colors[status] }}>
              {labels[status]} ({items.length})
            </div>
            {items.map(t => {
              const zone = zoneMap.get(t.zone_id ?? '');
              const time = t.pickup_time
                ? new Date(t.pickup_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                : '—';
              return (
                <div key={t.request_id}
                  className="bg-[var(--hl-card,#1a2235)] border border-[var(--hl-border)] rounded-xl p-3 mb-2">
                  <div className="flex gap-3">
                    <span className="text-lg">{t.direction === 'to_zone' ? '🚗➡️' : '⬅️🚗'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold mb-1">{t.staff_name}</div>
                      <div className="text-[10px] text-[var(--hl-muted)] mb-1">
                        📍 {t.pickup_address || '—'} →{' '}
                        <span style={{ color: zone?.display_color }}>{zone?.zone_code} {t.zone_name}</span>
                      </div>
                      <div className="text-[10px] text-[var(--hl-muted)]">
                        ⏰ {time}
                        {t.phone && <> · <a href={`tel:${t.phone}`} className="text-[var(--hl-blue)]">{t.phone}</a></>}
                      </div>
                      {t.driver_name && (
                        <div className="text-[10px] text-[var(--hl-green)] mt-1">🚗 {t.driver_name}</div>
                      )}
                      {t.notes && (
                        <div className="text-[10px] text-[var(--hl-muted)] italic mt-1">{t.notes}</div>
                      )}
                    </div>
                  </div>
                  {status === 'pending' && (
                    <AssignDriverButton requestId={t.request_id} raceId={raceId} onDone={onRefresh} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

// ── CHECKLIST TAB ─────────────────────────────────────────────
function ChecklistTab({ zones, raceId }: { zones: RaceZone[]; raceId: string }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] text-[var(--hl-muted)] mb-3">
        Zone Lead hoàn thành checklist trước khi rời vị trí.
      </div>
      {zones.map(z => (
        <button key={z.zone_id}
          className="w-full bg-[var(--hl-card,#1a2235)] border border-[var(--hl-border)] rounded-xl p-3 flex items-center gap-3 hover:border-white/20 transition-all text-left"
          onMouseEnter={e => (e.currentTarget.style.borderColor = z.display_color)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '')}
        >
          <span className="text-lg">{z.display_icon}</span>
          <span className="flex-1 text-[12px] font-bold">{z.name}</span>
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
            style={{ background: `${z.display_color}22`, color: z.display_color }}>
            {z.zone_code}
          </span>
          <span className="text-[var(--hl-muted)] text-sm">›</span>
        </button>
      ))}
    </div>
  );
}

// ── REUSABLE COMPONENTS ───────────────────────────────────────

function MiniStat({ icon, label, value, color }: {
  icon: string; label: string; value: string | number; color: string;
}) {
  return (
    <div className="bg-black/20 rounded-lg p-2 text-center">
      <div className="text-[11px] font-bold" style={{ color }}>{value}</div>
      <div className="text-[8px] text-[var(--hl-muted)] mt-0.5">{icon} {label}</div>
    </div>
  );
}

function StaffRow({ staff: s }: { staff: EventStaff }) {
  const statusColor: Record<string, string> = {
    pending: 'var(--hl-muted)',
    checked_in: 'var(--hl-blue)',
    on_duty: 'var(--hl-green)',
    off_duty: 'var(--hl-muted)',
    emergency: 'var(--hl-red)',
  };
  const color = statusColor[s.status] ?? 'var(--hl-muted)';
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold flex-shrink-0"
        style={{ borderColor: color, color, background: `${color}22` }}>
        {s.full_name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold truncate">{s.full_name}</div>
        <div className="text-[9px] text-[var(--hl-muted)]">
          {s.position_code && <span className="font-mono text-[var(--hl-accent)]">{s.position_code} · </span>}
          {s.role}
          {s.transport_need !== 'self' && <span className="text-[var(--hl-warn)] ml-1">🚗 cần xe</span>}
        </div>
      </div>
      <span className="text-[8px] font-bold px-2 py-0.5 rounded-full"
        style={{ background: `${color}22`, color }}>
        {s.status === 'on_duty' ? 'Trực' : s.status === 'checked_in' ? 'Đến' : 'Chờ'}
      </span>
    </div>
  );
}

function InventoryRow({ item: i, raceId, onRefresh }: {
  item: ZoneInventory; raceId: string; onRefresh: () => void;
}) {
  const pct = i.qty_received > 0 ? Math.round(i.qty_current / i.qty_received * 100) : 0;
  const isLow = pct < i.alert_threshold;
  const [updating, setUpdating] = useState(false);

  const updateStock = async (type: 'receive' | 'consume') => {
    const qty = parseInt(prompt(`${type === 'receive' ? 'Nhận thêm' : 'Tiêu thụ'} bao nhiêu?`) ?? '0');
    if (!qty || qty <= 0) return;
    setUpdating(true);
    try {
      const newQty = type === 'receive' ? i.qty_current + qty : Math.max(0, i.qty_current - qty);
      const now = new Date().toISOString();
      await fetch(`${SB_URL}/rest/v1/zone_inventory?inv_id=eq.${i.inv_id}`, {
        method: 'PATCH',
        headers: { ...H, 'Content-Type': 'application/json', 'Content-Profile': 'hlrace', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ qty_current: newQty, last_updated_at: now, updated_at: now }),
      });
      // Log transaction (append-only)
      await fetch(`${SB_URL}/rest/v1/inventory_transactions`, {
        method: 'POST',
        headers: { ...H, 'Content-Type': 'application/json', 'Content-Profile': 'hlrace', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ race_id: raceId, inv_id: i.inv_id, to_zone_id: i.zone_id, txn_type: type, qty, created_at: now }),
      });
      onRefresh();
    } finally { setUpdating(false); }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex justify-between mb-1">
          <span className="text-[11px]">{i.item_name}</span>
          <span className="text-[11px] font-bold" style={{ color: isLow ? 'var(--hl-red)' : 'var(--hl-text)' }}>
            {i.qty_current}/{i.qty_received} {i.unit}
          </span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: isLow ? 'var(--hl-red)' : 'var(--hl-green)' }} />
        </div>
      </div>
      <button
        onClick={() => updateStock('consume')}
        disabled={updating}
        className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-[12px] font-bold hover:bg-red-500/20 transition-all flex items-center justify-center"
      >−</button>
      <button
        onClick={() => updateStock('receive')}
        disabled={updating}
        className="w-7 h-7 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-[12px] font-bold hover:bg-green-500/20 transition-all flex items-center justify-center"
      >+</button>
    </div>
  );
}

function AssignZoneButton({ staffId, raceId, onDone }: {
  staffId: string; raceId: string; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const assign = async () => {
    // Lấy danh sách zones
    const zones = await sbFetch<RaceZone>(
      'race_zones',
      `race_id=eq.${raceId}&deleted_at=is.null&order=zone_code.asc`
    );
    if (!zones.length) { alert('Chưa có zone nào. Vẽ zone trên map trước.'); return; }

    const list = zones.map((z, i) => `${i + 1}. ${z.zone_code} — ${z.name}`).join('\n');
    const choice = parseInt(prompt(`Phân vào zone nào?\n${list}\n\nNhập số:`) ?? '0');
    if (!choice || choice < 1 || choice > zones.length) return;

    const zone = zones[choice - 1];
    const existingInZone = await sbFetch<EventStaff>(
      'event_staff',
      `race_id=eq.${raceId}&zone_id=eq.${zone.zone_id}&deleted_at=is.null`
    );
    const posCode = `${zone.zone_code}.${String(existingInZone.length + 1).padStart(2, '0')}`;

    setLoading(true);
    try {
      await fetch(`${SB_URL}/rest/v1/event_staff?staff_id=eq.${staffId}`, {
        method: 'PATCH',
        headers: { ...H, 'Content-Type': 'application/json', 'Content-Profile': 'hlrace', 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          zone_id: zone.zone_id,
          position_code: posCode,
          updated_at: new Date().toISOString(),
        }),
      });
      onDone();
    } finally { setLoading(false); }
  };

  return (
    <button onClick={assign} disabled={loading}
      className="px-3 py-1.5 rounded-lg bg-[var(--hl-accent)] text-white text-[10px] font-bold hover:brightness-110 transition-all disabled:opacity-50">
      {loading ? '...' : 'Phân zone'}
    </button>
  );
}

function AssignDriverButton({ requestId, raceId, onDone }: {
  requestId: string; raceId: string; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const assign = async () => {
    const name = prompt('Tên tài xế:')?.trim();
    if (!name) return;
    const phone = prompt('SĐT tài xế:') ?? '';
    setLoading(true);
    try {
      await fetch(`${SB_URL}/rest/v1/transport_requests?request_id=eq.${requestId}`, {
        method: 'PATCH',
        headers: { ...H, 'Content-Type': 'application/json', 'Content-Profile': 'hlrace', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'assigned', driver_name: name, driver_phone: phone, updated_at: new Date().toISOString() }),
      });
      onDone();
    } finally { setLoading(false); }
  };
  return (
    <button onClick={assign} disabled={loading}
      className="w-full mt-2 py-1.5 rounded-lg bg-[var(--hl-accent)]/10 text-[var(--hl-accent)] border border-[var(--hl-accent)]/30 text-[10px] font-bold hover:bg-[var(--hl-accent)]/20 transition-all">
      {loading ? '⏳...' : '🚗 Phân xe'}
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-screen bg-[var(--hl-bg)]">
      <div className="text-center">
        <div className="text-[10px] font-bold tracking-[3px] uppercase text-[var(--hl-accent)] mb-3">
          Zone Operations
        </div>
        <div className="w-8 h-8 border-2 border-[var(--hl-accent)] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );
}

// ── HELPERS ───────────────────────────────────────────────────
function calcCenter(points: ZonePolygonPoint[]) {
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

function getZoneIcon(type: RaceZone['zone_type']): string {
  const icons: Record<string, string> = {
    start_finish: '🏁', expo: '🎪', parking: '🅿️',
    recovery: '💆', medical: '🏥', checkpoint: '📍',
    water_station: '💧', vip: '👑', general: '📌',
  };
  return icons[type] ?? '📍';
}

// ── MAPBOX RENDERING ──────────────────────────────────────────
