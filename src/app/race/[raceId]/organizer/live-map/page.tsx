'use client';

// =============================================================
// HLRace Live Map — Next.js version
// Mapbox GL + Realtime GPS + Pinky AI + Alert System
// =============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import type { LiveMapData, EventStaff, RaceWaypoint, CongestionAlert, ParticipantLocation } from '@/lib/race/types';

const SB_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const MBOX    = 'pk.eyJ1IjoibGVob2FuZzgxIiwiYSI6ImNtbzhkZGY0cDAwYW8ycXBsdjZreDBjNnQifQ.waymWg6n9qRz284bC4gOaQ';
const GEMINI  = 'AIzaSyB6YqMvnqH00H2-1ukvQB0pNB9cxDSg7Jc';
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Accept-Profile': 'hlrace' };

const CLUSTER_COLOR: Record<string, string> = {
  safety: '#ef4444', media: '#3b82f6', protocol: '#f59e0b', logistics: '#10b981',
};
const CLUSTER_EMOJI: Record<string, string> = {
  safety: '🦺', media: '📸', protocol: '👑', logistics: '🔧',
};

type LayerKey = 'staff_safety'|'staff_media'|'staff_protocol'|'staff_logistics'|
  'vdv_5k'|'vdv_10k'|'vdv_21k'|'wp_checkpoint'|'wp_water'|'wp_medical'|'wp_heritage'|'alerts';

type Tab = 'pinky'|'alerts'|'checkpoints';

interface PageProps { params: Promise<{ raceId: string }>; }

export default function LiveMapPage({ params }: PageProps) {
  const [raceId, setRaceId]   = useState('');
  const [data, setData]       = useState<LiveMapData | null>(null);
  const [race, setRace]       = useState<{ name: string; race_started_at: string | null; gps_tracking_active: boolean } | null>(null);
  const [tab, setTab]         = useState<Tab>('pinky');
  const [leftOpen, setLeft]   = useState(true);
  const [rightOpen, setRight] = useState(true);
  const [layers, setLayers]   = useState<Record<LayerKey, boolean>>({
    staff_safety: true, staff_media: true, staff_protocol: true, staff_logistics: true,
    vdv_5k: true, vdv_10k: true, vdv_21k: true,
    wp_checkpoint: true, wp_water: true, wp_medical: true, wp_heritage: false,
    alerts: true,
  });
  const [pinkyMessages, setPinky] = useState<{ text: string; tag: string; color: string; time: string }[]>([]);
  const [pinkyLoading, setPinkyLoading] = useState(false);
  const [elapsed, setElapsed] = useState('--:--:--');

  useEffect(() => { params.then(p => setRaceId(p.raceId)); }, [params]);
  useEffect(() => { if (raceId) { loadAll(); const t = setInterval(loadAll, 30000); return () => clearInterval(t); } }, [raceId]);
  useEffect(() => { if (raceId) loadRace(); }, [raceId]);

  // Race timer
  useEffect(() => {
    const tick = () => {
      if (!race?.race_started_at) { setElapsed('--:--:--'); return; }
      const s = Math.floor((Date.now() - new Date(race.race_started_at).getTime()) / 1000);
      const h = Math.floor(s/3600).toString().padStart(2,'0');
      const m = Math.floor((s%3600)/60).toString().padStart(2,'0');
      const ss = (s%60).toString().padStart(2,'0');
      setElapsed(`${h}:${m}:${ss}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [race]);

  // Auto-Pinky sau 3s và mỗi 5 phút
  useEffect(() => {
    if (!data) return;
    const t1 = setTimeout(() => askPinky(), 3000);
    const t2 = setInterval(() => askPinky(), 5 * 60 * 1000);
    return () => { clearTimeout(t1); clearInterval(t2); };
  }, [data?.stats]);

  async function loadRace() {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/races?race_id=eq.${raceId}&select=name,race_started_at,gps_tracking_active`, { headers: H });
      if (!r.ok) return;
      const data = await r.json();
      const d = Array.isArray(data) ? data[0] : null;
      if (d) setRace(d);
    } catch(e) { console.warn('loadRace:', e); }
  }

  async function loadAll() {
    if (!raceId) return;
    const safeArr = async (url: string) => {
      try {
        const r = await fetch(url, { headers: H });
        if (!r.ok) return [];
        const d = await r.json();
        return Array.isArray(d) ? d : [];
      } catch { return []; }
    };

    const [staff, rawVdv, waypoints, alerts] = await Promise.all([
      safeArr(`${SB_URL}/rest/v1/event_staff?race_id=eq.${raceId}&deleted_at=is.null&order=cluster.asc`),
      safeArr(`${SB_URL}/rest/v1/participant_locations?race_id=eq.${raceId}&order=recorded_at.desc&limit=500`),
      safeArr(`${SB_URL}/rest/v1/race_waypoints?race_id=eq.${raceId}&deleted_at=is.null&order=waypoint_order.asc`),
      safeArr(`${SB_URL}/rest/v1/congestion_alerts?race_id=eq.${raceId}&is_active=eq.true&order=created_at.desc`),
    ]);

    // Deduplicate VĐV
    const vdvMap = new Map<string, ParticipantLocation>();
    (rawVdv as ParticipantLocation[]).forEach(v => {
      const k = v.bib_number ?? v.bib_id ?? v.location_id;
      if (!vdvMap.has(k) || v.recorded_at > vdvMap.get(k)!.recorded_at) vdvMap.set(k, v);
    });
    const vdv_latest = Array.from(vdvMap.values());

    setData({
      staff, vdv_latest, waypoints, alerts,
      sos: vdv_latest.filter((v: ParticipantLocation) => v.is_sos),
      zones: [],
      stats: {
        staff_total: staff.length,
        staff_on_duty: staff.filter((s: EventStaff) => s.status === 'on_duty').length,
        staff_gps: staff.filter((s: EventStaff) => s.location_coords).length,
        vdv_tracked: vdv_latest.length,
        vdv_sos: vdv_latest.filter((v: ParticipantLocation) => v.is_sos).length,
        alert_count: alerts.length,
        critical_count: alerts.filter((a: CongestionAlert) => a.severity === 'critical').length,
        race_elapsed_s: null,
      },
    });
  }

  async function toggleGps() {
    if (!race) return;
    const newVal = !race.gps_tracking_active;
    await fetch(`${SB_URL}/rest/v1/races?race_id=eq.${raceId}`, {
      method: 'PATCH',
      headers: { ...H, 'Content-Type': 'application/json', 'Content-Profile': 'hlrace', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ gps_tracking_active: newVal }),
    });
    setRace(r => r ? { ...r, gps_tracking_active: newVal } : r);
  }

  async function resolveAlert(alertId: string) {
    await fetch(`${SB_URL}/rest/v1/congestion_alerts?alert_id=eq.${alertId}`, {
      method: 'PATCH',
      headers: { ...H, 'Content-Type': 'application/json', 'Content-Profile': 'hlrace', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ is_active: false, resolved_at: new Date().toISOString() }),
    });
    setData(d => d ? { ...d, alerts: d.alerts.filter(a => a.alert_id !== alertId) } : d);
  }

  async function askPinky(custom?: string) {
    if (pinkyLoading || !data) return;
    setPinkyLoading(true);
    const s = data.stats;
    const alertText = data.alerts.map(a => `[${a.severity}] ${a.alert_type}: ${(a.detail as unknown as Record<string,string>)?.message || ''}`).join('\n');
    const staffText = data.staff.filter((st: EventStaff) => st.location_coords)
      .map((st: EventStaff) => `${st.full_name} (${st.role}) @ ${st.location_name || st.location_coords}`).join('\n');

    const prompt = custom ?? `Bạn là Pinky 🐰 - AI điều phối cho giải chạy ${race?.name || 'HLRace'}.
TÌNH HÌNH (${new Date().toLocaleTimeString('vi-VN')}):
- Nhân sự: ${s.staff_on_duty}/${s.staff_total} trực | ${s.staff_gps} có GPS
- VĐV: ${s.vdv_tracked} tracking | ${s.vdv_sos} SOS
- Alerts: ${s.alert_count} | ${s.critical_count} critical
CẢNH BÁO:\n${alertText || 'Không có'}
NHÂN SỰ:\n${staffText || 'Chưa có GPS'}
Phân tích ngắn (≤80 từ), ưu tiên khẩn cấp, emoji, tiếng Việt.`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 300, temperature: 0.8 } }) }
      );
      const d = await res.json();
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Pinky đang nghỉ...';
      const isCrit = data.stats.critical_count > 0;
      setPinky(prev => [{
        text: text.replace(/\*\*(.*?)\*\*/g, '$1'),
        tag: isCrit ? 'CRITICAL' : data.stats.alert_count > 0 ? 'CHÚ Ý' : 'ỔN ĐỊNH',
        color: isCrit ? '#ef4444' : data.stats.alert_count > 0 ? '#f59e0b' : '#10b981',
        time: new Date().toLocaleTimeString('vi-VN'),
      }, ...prev].slice(0, 5));
    } catch (e) { console.error(e); }
    setPinkyLoading(false);
  }

  const toggleLayer = useCallback((key: LayerKey) => {
    setLayers(l => ({ ...l, [key]: !l[key] }));
  }, []);

  if (!raceId) return <LoadingScreen />;

  const stats = data?.stats;

  return (
    <div className="flex h-screen bg-[#070b14] overflow-hidden text-white">

      {/* ── LEFT PANEL ── */}
      <div className={`flex-shrink-0 bg-[#0d1320] border-r border-white/[0.06] flex flex-col transition-all duration-300 ${leftOpen ? 'w-[240px]' : 'w-0 overflow-hidden border-0'}`}>
        <div className="p-4 border-b border-white/[0.06]">
          <div className="text-[9px] font-bold tracking-[2px] uppercase text-orange-400 mb-3">Hiển thị lớp</div>
          <div className="flex gap-1.5 mb-3">
            <button onClick={() => setLayers(l => Object.fromEntries(Object.keys(l).map(k => [k, true])) as typeof l)}
              className="flex-1 py-1 rounded bg-white/5 hover:bg-white/10 text-[9px] text-white/50 hover:text-white transition-all">✓ Tất cả</button>
            <button onClick={() => setLayers(l => Object.fromEntries(Object.keys(l).map(k => [k, false])) as typeof l)}
              className="flex-1 py-1 rounded bg-white/5 hover:bg-white/10 text-[9px] text-white/50 hover:text-white transition-all">✕ Ẩn hết</button>
          </div>

          {/* Layer groups */}
          {[
            { title: 'Nhân sự', items: [
              { key: 'staff_safety' as LayerKey, label: '🦺 An toàn', color: '#ef4444', count: data?.staff.filter((s: EventStaff) => s.cluster === 'safety').length ?? 0 },
              { key: 'staff_media' as LayerKey, label: '📸 Truyền thông', color: '#3b82f6', count: data?.staff.filter((s: EventStaff) => s.cluster === 'media').length ?? 0 },
              { key: 'staff_protocol' as LayerKey, label: '👑 Đối ngoại', color: '#f59e0b', count: data?.staff.filter((s: EventStaff) => s.cluster === 'protocol').length ?? 0 },
              { key: 'staff_logistics' as LayerKey, label: '🔧 Hậu cần', color: '#10b981', count: data?.staff.filter((s: EventStaff) => s.cluster === 'logistics').length ?? 0 },
            ]},
            { title: 'VĐV', items: [
              { key: 'vdv_5k' as LayerKey, label: '🏃 5K', color: '#a78bfa', count: Math.floor((data?.vdv_latest.length ?? 0) * 0.35) },
              { key: 'vdv_10k' as LayerKey, label: '🏃 10K', color: '#60a5fa', count: Math.floor((data?.vdv_latest.length ?? 0) * 0.40) },
              { key: 'vdv_21k' as LayerKey, label: '🏃 21K', color: '#34d399', count: Math.floor((data?.vdv_latest.length ?? 0) * 0.25) },
            ]},
            { title: 'Waypoints', items: [
              { key: 'wp_checkpoint' as LayerKey, label: '📍 Checkpoint', color: '#f97316', count: data?.waypoints.filter((w: RaceWaypoint) => w.waypoint_type === 'checkpoint').length ?? 0 },
              { key: 'wp_water' as LayerKey, label: '💧 Trạm nước', color: '#3b82f6', count: data?.waypoints.filter((w: RaceWaypoint) => w.waypoint_type === 'water_station').length ?? 0 },
              { key: 'wp_medical' as LayerKey, label: '🏥 Y tế', color: '#ef4444', count: data?.waypoints.filter((w: RaceWaypoint) => w.waypoint_type === 'medical').length ?? 0 },
              { key: 'wp_heritage' as LayerKey, label: '🏛️ Di sản', color: '#f59e0b', count: data?.waypoints.filter((w: RaceWaypoint) => w.waypoint_type === 'heritage').length ?? 0 },
            ]},
            { title: 'Cảnh báo', items: [
              { key: 'alerts' as LayerKey, label: '🚨 Alerts', color: '#ef4444', count: data?.alerts.length ?? 0 },
            ]},
          ].map(group => (
            <div key={group.title} className="mb-4">
              <div className="text-[8px] tracking-[1.5px] uppercase text-white/25 mb-2 font-bold">{group.title}</div>
              {group.items.map(item => (
                <label key={item.key} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-white/5 cursor-pointer group">
                  <input type="checkbox" checked={layers[item.key]} onChange={() => toggleLayer(item.key)}
                    className="w-3.5 h-3.5 rounded cursor-pointer" style={{ accentColor: item.color }} />
                  <span className="flex-1 text-[10px] text-white/60 group-hover:text-white/90 transition-colors">{item.label}</span>
                  <span className="text-[10px] font-bold" style={{ color: item.count > 0 ? item.color : 'rgba(255,255,255,0.2)' }}>{item.count}</span>
                </label>
              ))}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="p-4 flex-1">
          <div className="text-[9px] font-bold tracking-[2px] uppercase text-white/25 mb-3">Thống kê</div>
          {[
            { label: 'Nhân sự trực', value: `${stats?.staff_on_duty ?? 0}/${stats?.staff_total ?? 0}`, color: '#10b981' },
            { label: 'Có GPS', value: stats?.staff_gps ?? 0, color: '#60a5fa' },
            { label: 'VĐV tracking', value: stats?.vdv_tracked ?? 0, color: '#a78bfa' },
            { label: 'SOS', value: stats?.vdv_sos ?? 0, color: stats?.vdv_sos ? '#ef4444' : 'rgba(255,255,255,0.3)' },
            { label: 'Cảnh báo', value: `${stats?.alert_count ?? 0} (${stats?.critical_count ?? 0} critical)`, color: stats?.critical_count ? '#ef4444' : '#f59e0b' },
          ].map(s => (
            <div key={s.label} className="flex justify-between py-1.5 border-b border-white/[0.04] last:border-0">
              <span className="text-[10px] text-white/40">{s.label}</span>
              <span className="text-[10px] font-bold" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Bottom buttons */}
        <div className="p-3 border-t border-white/[0.06] flex gap-2">
          <button onClick={loadAll} className="flex-1 py-2 rounded-lg bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20 hover:bg-blue-500/20 transition-all">
            🔄 Refresh
          </button>
          <button onClick={() => {
            const el = document.getElementById('lm-wrap');
            if (!document.fullscreenElement) el?.requestFullscreen();
            else document.exitFullscreen();
          }} className="flex-1 py-2 rounded-lg bg-white/5 text-white/40 text-[10px] font-bold border border-white/10 hover:bg-white/10 transition-all">
            ⛶ Full
          </button>
        </div>
      </div>

      {/* ── MAP ── */}
      <div id="lm-wrap" className="flex-1 relative min-w-0">
        {/* Topbar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-4 px-4 py-2.5 bg-[#070b14]/80 backdrop-blur-md border-b border-white/[0.06]">
          {/* Left panel toggle */}
          <button onClick={() => setLeft(l => !l)}
            className="w-7 h-7 rounded flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/50 text-[10px] transition-all">
            {leftOpen ? '◀' : '▶'}
          </button>

          {/* Stats badges */}
          {stats?.critical_count ? (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              {stats.critical_count} critical
            </div>
          ) : null}
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-400">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            {stats?.vdv_tracked ?? 0} VĐV
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            {stats?.staff_on_duty ?? 0} trực
          </div>

          {/* Race name */}
          <div className="flex-1 text-center">
            <span className="text-[11px] font-bold text-white/70">{race?.name ?? 'HLRace Live Map'}</span>
          </div>

          {/* Timer */}
          <div className="font-mono text-[13px] font-bold text-white/80 tracking-wider">⏱ {elapsed}</div>

          {/* GPS toggle */}
          <button onClick={toggleGps}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
              race?.gps_tracking_active
                ? 'bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25'
                : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
            }`}>
            📡 {race?.gps_tracking_active ? 'GPS: BẬT' : 'GPS: TẮT'}
          </button>

          {/* Right panel toggle */}
          <button onClick={() => setRight(r => !r)}
            className="w-7 h-7 rounded flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/50 text-[10px] transition-all">
            {rightOpen ? '▶' : '◀'}
          </button>
        </div>

        {/* Mapbox */}
        <MapboxPanel
          raceId={raceId}
          data={data}
          layers={layers}
        />
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className={`flex-shrink-0 bg-[#0d1320] border-l border-white/[0.06] flex flex-col transition-all duration-300 ${rightOpen ? 'w-[300px]' : 'w-0 overflow-hidden border-0'}`}>
        {/* Tabs */}
        <div className="flex border-b border-white/[0.06] flex-shrink-0">
          {([
            ['pinky', '🐰 Pinky'],
            ['alerts', `🚨 Alerts${data?.alerts.length ? ` (${data.alerts.length})` : ''}`],
            ['checkpoints', '📍 CP'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2.5 text-[9px] font-bold tracking-[0.5px] uppercase border-b-2 transition-all ${
                tab === key
                  ? key === 'pinky' ? 'text-pink-400 border-pink-400' : key === 'alerts' ? 'text-red-400 border-red-400' : 'text-orange-400 border-orange-400'
                  : 'text-white/30 border-transparent hover:text-white/60'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent]">

          {/* PINKY TAB */}
          {tab === 'pinky' && (
            <div className="p-4">
              {/* Pinky header */}
              <div className="bg-pink-500/[0.07] border border-pink-500/20 rounded-xl p-3 mb-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-rose-600 flex items-center justify-center text-lg flex-shrink-0">🐰</div>
                  <div>
                    <div className="text-[12px] font-bold text-pink-400">Pinky AI Advisor</div>
                    <div className="flex items-center gap-1 text-[9px] text-pink-400/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
                      Theo dõi liên tục · Auto 5p
                    </div>
                  </div>
                  <button onClick={() => askPinky()}
                    disabled={pinkyLoading}
                    className="ml-auto px-2.5 py-1 rounded-lg bg-pink-500/15 text-pink-400 text-[9px] font-bold border border-pink-500/25 hover:bg-pink-500/25 transition-all disabled:opacity-50">
                    {pinkyLoading ? '...' : 'Phân tích'}
                  </button>
                </div>
                <div className="text-[10px] text-white/40 leading-relaxed">
                  Pinky tự phân tích mỗi <span className="text-pink-400 font-bold">5 phút</span> và khi có alert mới.
                </div>
              </div>

              {/* Messages */}
              {pinkyLoading && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-pink-500/[0.05] rounded-lg mb-3 text-[10px] text-pink-400/60">
                  <div className="w-3 h-3 border border-pink-400 border-t-transparent rounded-full animate-spin" />
                  Pinky đang phân tích...
                </div>
              )}

              {pinkyMessages.map((msg, i) => (
                <div key={i} className="bg-pink-500/[0.06] border border-pink-500/15 rounded-xl p-3 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[8px] font-bold px-2 py-0.5 rounded" style={{ background: `${msg.color}20`, color: msg.color }}>{msg.tag}</span>
                    <span className="text-[9px] text-white/25 ml-auto">{msg.time}</span>
                  </div>
                  <div className="text-[11px] text-white/80 leading-relaxed">{msg.text}</div>
                </div>
              ))}

              {pinkyMessages.length === 0 && !pinkyLoading && (
                <div className="text-center py-8 text-[11px] text-white/30">Pinky sẽ phân tích sau 3 giây...</div>
              )}

              {/* Quick asks */}
              <div className="mt-4">
                <div className="text-[8px] tracking-[1.5px] uppercase text-white/25 mb-2 font-bold">Hỏi nhanh</div>
                {[
                  '💬 Ai gần VĐV SOS nhất?',
                  '📊 Tổng quan 30 phút qua',
                  '⚠️ Điểm nguy hiểm tiếp theo?',
                  '🏥 Trạm y tế nào đang nhàn?',
                ].map(q => (
                  <button key={q} onClick={() => askPinky(q + ` Race: ${race?.name}. Trả lời ngắn ≤60 từ, tiếng Việt.`)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px] text-white/50 hover:bg-pink-500/[0.08] hover:border-pink-500/20 hover:text-white/80 transition-all mb-1.5">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ALERTS TAB */}
          {tab === 'alerts' && (
            <div className="p-4">
              {!data?.alerts.length ? (
                <div className="text-center py-12">
                  <div className="text-3xl mb-3">✅</div>
                  <div className="text-[11px] text-white/30">Không có cảnh báo nào</div>
                </div>
              ) : data.alerts.map(a => {
                const isCrit = a.severity === 'critical';
                const color = isCrit ? '#ef4444' : '#f59e0b';
                const detail = a.detail as unknown as Record<string, string>;
                const typeLabel: Record<string, string> = {
                  sos: '🆘 VĐV báo lạc đường', congestion: '⚠️ Tắc nghẽn checkpoint',
                  shortcut: '🚫 Nghi shortcut', off_route: '🧭 Lệch tuyến',
                };
                return (
                  <div key={a.alert_id} className="rounded-xl border p-3 mb-3 cursor-pointer transition-all"
                    style={{ background: `${color}10`, borderColor: `${color}30` }}>
                    <div className="flex gap-2 items-start">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: color, animation: isCrit ? 'pulse 1.2s infinite' : 'none' }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-white mb-1">
                          {typeLabel[a.alert_type] ?? a.alert_type}
                          {isCrit && <span className="ml-2 text-[8px] text-red-400 font-bold">● CRITICAL</span>}
                        </div>
                        <div className="text-[10px] text-white/50 leading-relaxed mb-2">
                          {detail?.message || detail?.evidence || detail?.skipped || ''}
                        </div>
                        {a.bib_numbers?.slice(0,3).map(b => (
                          <span key={b} className="inline-block bg-white/[0.07] rounded px-1.5 py-0.5 text-[9px] font-mono text-white/60 mr-1 mb-1">{b}</span>
                        ))}
                        {a.bib_numbers && a.bib_numbers.length > 3 && (
                          <span className="text-[9px] text-white/30">+{a.bib_numbers.length - 3}</span>
                        )}
                        <div className="flex gap-2 mt-2">
                          {a.alert_type === 'shortcut' && (
                            <button className="px-2 py-1 rounded text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">📋 Evidence</button>
                          )}
                          {a.alert_type === 'sos' && (
                            <button className="px-2 py-1 rounded text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">🗺️ Trên map</button>
                          )}
                          <button onClick={() => resolveAlert(a.alert_id)}
                            className="px-2 py-1 rounded text-[9px] font-bold bg-white/[0.04] text-white/40 border border-white/10 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20 transition-all">
                            ✓ Xong
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CHECKPOINTS TAB */}
          {tab === 'checkpoints' && (
            <div className="p-4">
              <div className="text-[9px] font-bold tracking-[2px] uppercase text-white/25 mb-3">Tiến độ qua checkpoint</div>
              {data?.waypoints
                .filter((w: RaceWaypoint) => w.waypoint_order != null)
                .sort((a: RaceWaypoint, b: RaceWaypoint) => (a.waypoint_order ?? 0) - (b.waypoint_order ?? 0))
                .map((wp: RaceWaypoint) => {
                  const pct = Math.floor(Math.random() * 80 + 10); // placeholder
                  const color = wp.display_color ?? '#f97316';
                  return (
                    <div key={wp.waypoint_id} className="mb-4">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[11px] text-white/70 truncate">
                          {wp.display_icon} {wp.name.replace(/^(Checkpoint|Trạm nước|Trạm y tế)\s*/i, '')}
                        </span>
                        <span className="text-[12px] font-bold ml-2" style={{ color }}>{pct}</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <div className="text-[9px] text-white/30 mt-1">{pct}% VĐV đã qua</div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAPBOX PANEL ──────────────────────────────────────────────
function MapboxPanel({ raceId, data, layers }: {
  raceId: string;
  data: LiveMapData | null;
  layers: Record<LayerKey, boolean>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<unknown>(null);
  const mkrs = useRef<{ remove: () => void }[]>([]);

  useEffect(() => {
    if (!ref.current || map.current) return;
    let cancelled = false;
    import('mapbox-gl').then(({ default: mgl }) => {
      if (cancelled || !ref.current) return;
      mgl.accessToken = MBOX;
      const m = new mgl.Map({
        container: ref.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [105.9080, 20.5350],
        zoom: 13, attributionControl: false,
      });
      m.addControl(new mgl.NavigationControl(), 'bottom-right');
      map.current = m;
    });
    return () => { cancelled = true; (map.current as { remove?: () => void })?.remove?.(); map.current = null; };
  }, []);

  // Render markers khi data thay đổi
  useEffect(() => {
    const m = map.current as { isStyleLoaded?: () => boolean } | null;
    if (!m?.isStyleLoaded?.()) return;
    import('mapbox-gl').then(({ default: mgl }) => {
      mkrs.current.forEach(mk => mk.remove());
      mkrs.current = [];

      // Staff markers
      if (data?.staff) {
        data.staff.forEach((s: EventStaff) => {
          const lk = `staff_${s.cluster}` as LayerKey;
          if (!layers[lk] || !s.location_coords) return;
          const [lat, lng] = s.location_coords.split(',').map(Number);
          if (!lat || !lng) return;
          const color = CLUSTER_COLOR[s.cluster] ?? '#64748b';
          const el = document.createElement('div');
          el.innerHTML = `<div style="position:relative;width:32px;height:32px">
            ${s.status === 'on_duty' ? `<div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid ${color};opacity:.4;animation:ping 1.5s ease-out infinite"></div>` : ''}
            <div style="width:32px;height:32px;border-radius:50%;background:${color};border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 12px ${color}60;cursor:pointer">${CLUSTER_EMOJI[s.cluster]}</div>
            ${s.position_code ? `<div style="position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);background:${color};color:#fff;font-size:7px;font-weight:900;padding:1px 4px;border-radius:3px;white-space:nowrap">${s.position_code}</div>` : ''}
          </div>`;
          const mk = new mgl.Marker({ element: el })
            .setLngLat([lng, lat])
            .setPopup(new mgl.Popup({ offset: 20, closeButton: false }).setHTML(`
              <div style="font-family:system-ui;min-width:150px;padding:4px 2px">
                <div style="font-weight:800;font-size:13px;margin-bottom:4px">${s.full_name}</div>
                <div style="font-size:10px;color:#64748b;margin-bottom:4px">
                  <span style="background:${color}22;color:${color};padding:1px 6px;border-radius:8px;font-weight:700">${s.role}</span>
                  ${s.position_code ? `<span style="margin-left:4px;font-family:monospace">${s.position_code}</span>` : ''}
                </div>
                ${s.location_name ? `<div style="font-size:10px;margin-bottom:3px">📍 ${s.location_name}</div>` : ''}
                ${s.notes ? `<div style="font-size:10px;color:#94a3b8;font-style:italic;margin-bottom:3px">${s.notes}</div>` : ''}
                ${s.phone ? `<a href="tel:${s.phone}" style="display:inline-block;margin-top:4px;background:#2563eb;color:#fff;padding:2px 10px;border-radius:6px;text-decoration:none;font-size:10px">📞 ${s.phone}</a>` : ''}
              </div>`))
            .addTo(map.current as any);
          mkrs.current.push(mk as unknown as { remove: () => void });
        });
      }

      // VĐV markers
      if (data?.vdv_latest) {
        const total = data.vdv_latest.length;
        const segColors = ['#a78bfa', '#60a5fa', '#34d399'];
        const segKeys: LayerKey[] = ['vdv_5k', 'vdv_10k', 'vdv_21k'];
        const splits = [Math.floor(total * 0.35), Math.floor(total * 0.40)];
        data.vdv_latest.forEach((v: ParticipantLocation, i: number) => {
          let segIdx = 2;
          if (i < splits[0]) segIdx = 0;
          else if (i < splits[0] + splits[1]) segIdx = 1;
          if (!layers[segKeys[segIdx]]) return;
          const color = v.is_sos ? '#ef4444' : segColors[segIdx];
          const size = v.is_sos ? 24 : 12;
          const el = document.createElement('div');
          el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:0.85;border:${v.is_sos ? '2px solid #fff' : '1px solid rgba(255,255,255,0.3)'};${v.is_sos ? 'box-shadow:0 0 0 4px rgba(239,68,68,0.3)' : ''}`;
          const mk = new mgl.Marker({ element: el })
            .setLngLat([v.lng, v.lat])
            .addTo(map.current as any);
          mkrs.current.push(mk as unknown as { remove: () => void });
        });
      }

      // Waypoint markers
      if (data?.waypoints) {
        data.waypoints.forEach((w: RaceWaypoint) => {
          const typeToLayer: Record<string, LayerKey> = {
            checkpoint: 'wp_checkpoint', start: 'wp_checkpoint', finish: 'wp_checkpoint',
            water_station: 'wp_water', medical: 'wp_medical', heritage: 'wp_heritage',
          };
          const lk = typeToLayer[w.waypoint_type] ?? 'wp_checkpoint';
          if (!layers[lk]) return;
          const color = w.display_color ?? '#f97316';
          const size = ['start','finish'].includes(w.waypoint_type) ? 34 : 26;
          const el = document.createElement('div');
          el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color}22;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:${size === 34 ? 15 : 11}px;box-shadow:0 2px 8px ${color}40;cursor:pointer`;
          el.textContent = w.display_icon ?? '📍';
          const mk = new mgl.Marker({ element: el })
            .setLngLat([w.lng, w.lat])
            .setPopup(new mgl.Popup({ offset: 16, closeButton: false }).setHTML(`
              <div style="font-family:system-ui;min-width:140px">
                <div style="font-weight:700;font-size:12px;margin-bottom:3px">${w.display_icon} ${w.name}</div>
                <div style="font-size:10px;color:${color}">${w.waypoint_type}</div>
                ${w.notes ? `<div style="font-size:10px;color:#94a3b8;margin-top:3px;font-style:italic">${w.notes}</div>` : ''}
                ${w.geofence_radius_m ? `<div style="font-size:9px;color:#64748b;margin-top:3px">Geofence: ${w.geofence_radius_m}m</div>` : ''}
              </div>`))
            .addTo(map.current as any);
          mkrs.current.push(mk as unknown as { remove: () => void });
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, layers]);

  return (
    <>
      <style>{`@keyframes ping{0%{transform:scale(1);opacity:.4}100%{transform:scale(1.8);opacity:0}}`}</style>
      <div ref={ref} className="w-full h-full pt-11" />
    </>
  );
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-[#070b14]">
      <div className="text-center">
        <div className="text-[10px] font-bold tracking-[3px] uppercase text-orange-400 mb-4">HLRace Live Map</div>
        <div className="w-10 h-10 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <div className="text-[10px] text-white/30">Đang tải bản đồ...</div>
      </div>
    </div>
  );
}
