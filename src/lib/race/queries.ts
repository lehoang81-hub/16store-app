// =============================================================
// HLRACE — Supabase Queries (Server-side)
// Dùng chung Supabase project với 16Store
// Schema: hlrace.* tables
// =============================================================

import { createClient } from '@/lib/supabase/server';
import type {
  Race, RaceZone, EventStaff, RaceWaypoint,
  ParticipantLocation, CongestionAlert, ZoneInventory,
  InventoryTransaction, TransportRequest,
  LiveMapData, LiveMapStats, ZoneWithStats,
} from './types';

// ── RACES ──────────────────────────────────────────────────────

export async function getRaceById(raceId: string): Promise<Race | null> {
  const sb = await createClient();
  const { data, error } = await sb
    .schema('hlrace')
    .from('races')
    .select('*')
    .eq('race_id', raceId)
    .is('deleted_at', null)
    .single();
  if (error) { console.error('getRaceById:', error); return null; }
  return data as Race;
}

export async function getRacesByOrganizer(organizerId: string): Promise<Race[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .schema('hlrace')
    .from('races')
    .select('*')
    .eq('organizer_id', organizerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) { console.error('getRacesByOrganizer:', error); return []; }
  return (data ?? []) as Race[];
}

// ── ZONES ──────────────────────────────────────────────────────

export async function getZonesByRace(raceId: string): Promise<RaceZone[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .schema('hlrace')
    .from('race_zones')
    .select('*')
    .eq('race_id', raceId)
    .is('deleted_at', null)
    .order('zone_code');
  if (error) { console.error('getZonesByRace:', error); return []; }
  return (data ?? []) as RaceZone[];
}

export async function getZonesWithStats(raceId: string): Promise<ZoneWithStats[]> {
  const [zones, staff, inventory, alerts] = await Promise.all([
    getZonesByRace(raceId),
    getStaffByRace(raceId),
    getInventoryByRace(raceId),
    getActiveAlerts(raceId),
  ]);

  const staffByZone = new Map<string, EventStaff[]>();
  staff.forEach(s => {
    const zid = s.zone_id ?? '__unassigned__';
    if (!staffByZone.has(zid)) staffByZone.set(zid, []);
    staffByZone.get(zid)!.push(s);
  });

  const invByZone = new Map<string, ZoneInventory[]>();
  inventory.forEach(i => {
    if (!i.zone_id) return;
    if (!invByZone.has(i.zone_id)) invByZone.set(i.zone_id, []);
    invByZone.get(i.zone_id)!.push(i);
  });

  const alertsByZone = new Map<string, CongestionAlert[]>();
  alerts.forEach(a => {
    if (!a.race_waypoint_id) return;
    if (!alertsByZone.has(a.race_waypoint_id)) alertsByZone.set(a.race_waypoint_id, []);
    alertsByZone.get(a.race_waypoint_id)!.push(a);
  });

  return zones.map(z => {
    const zStaff = staffByZone.get(z.zone_id) ?? [];
    const zInv   = invByZone.get(z.zone_id) ?? [];
    const zAlerts = alertsByZone.get(z.zone_id) ?? [];
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
      active_alerts: zAlerts,
    };
  });
}

// ── STAFF ──────────────────────────────────────────────────────

export async function getStaffByRace(raceId: string): Promise<EventStaff[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .schema('hlrace')
    .from('event_staff')
    .select('*')
    .eq('race_id', raceId)
    .is('deleted_at', null)
    .order('cluster')
    .order('position_code', { ascending: true, nullsFirst: false });
  if (error) { console.error('getStaffByRace:', error); return []; }
  return (data ?? []) as EventStaff[];
}

export async function getUnassignedStaff(raceId: string): Promise<EventStaff[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .schema('hlrace')
    .from('event_staff')
    .select('*')
    .eq('race_id', raceId)
    .is('zone_id', null)
    .is('deleted_at', null);
  if (error) { console.error('getUnassignedStaff:', error); return []; }
  return (data ?? []) as EventStaff[];
}

// ── WAYPOINTS ──────────────────────────────────────────────────

export async function getWaypointsByRace(raceId: string): Promise<RaceWaypoint[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .schema('hlrace')
    .from('race_waypoints')
    .select('*')
    .eq('race_id', raceId)
    .is('deleted_at', null)
    .order('waypoint_order', { ascending: true, nullsFirst: false });
  if (error) { console.error('getWaypointsByRace:', error); return []; }
  return (data ?? []) as RaceWaypoint[];
}

// ── LIVE MAP DATA ───────────────────────────────────────────────

export async function getLiveMapData(raceId: string): Promise<LiveMapData> {
  const [staff, rawVdv, waypoints, zones, alerts, race] = await Promise.all([
    getStaffByRace(raceId),
    getLatestParticipantLocations(raceId),
    getWaypointsByRace(raceId),
    getZonesByRace(raceId),
    getActiveAlerts(raceId),
    getRaceById(raceId),
  ]);

  // Deduplicate VĐV — chỉ lấy vị trí mới nhất per bib
  const vdvMap = new Map<string, ParticipantLocation>();
  rawVdv.forEach(v => {
    const key = v.bib_number ?? v.bib_id ?? v.location_id;
    const existing = vdvMap.get(key);
    if (!existing || v.recorded_at > existing.recorded_at) {
      vdvMap.set(key, v);
    }
  });
  const vdv_latest = Array.from(vdvMap.values());
  const sos = vdv_latest.filter(v => v.is_sos);

  // Race elapsed time
  let race_elapsed_s: number | null = null;
  if (race?.race_started_at) {
    race_elapsed_s = Math.floor(
      (Date.now() - new Date(race.race_started_at).getTime()) / 1000
    );
  }

  const stats: LiveMapStats = {
    staff_total:   staff.length,
    staff_on_duty: staff.filter(s => s.status === 'on_duty').length,
    staff_gps:     staff.filter(s => s.location_coords !== null).length,
    vdv_tracked:   vdv_latest.length,
    vdv_sos:       sos.length,
    alert_count:   alerts.length,
    critical_count: alerts.filter(a => a.severity === 'critical').length,
    race_elapsed_s,
  };

  return { staff, vdv_latest, waypoints, zones, alerts, sos, stats };
}

async function getLatestParticipantLocations(raceId: string): Promise<ParticipantLocation[]> {
  const sb = await createClient();
  // Lấy 500 bản ghi mới nhất — đã deduplicate ở trên
  const { data, error } = await sb
    .schema('hlrace')
    .from('participant_locations')
    .select('*')
    .eq('race_id', raceId)
    .order('recorded_at', { ascending: false })
    .limit(500);
  if (error) { console.error('getLatestParticipantLocations:', error); return []; }
  return (data ?? []) as ParticipantLocation[];
}

// ── ALERTS ─────────────────────────────────────────────────────

export async function getActiveAlerts(raceId: string): Promise<CongestionAlert[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .schema('hlrace')
    .from('congestion_alerts')
    .select('*')
    .eq('race_id', raceId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) { console.error('getActiveAlerts:', error); return []; }
  return (data ?? []) as CongestionAlert[];
}

// ── INVENTORY ──────────────────────────────────────────────────

export async function getInventoryByRace(raceId: string): Promise<ZoneInventory[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .schema('hlrace')
    .from('zone_inventory')
    .select('*')
    .eq('race_id', raceId)
    .is('deleted_at', null)
    .order('item_name');
  if (error) { console.error('getInventoryByRace:', error); return []; }
  return (data ?? []) as ZoneInventory[];
}

export async function getInventoryByZone(zoneId: string): Promise<ZoneInventory[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .schema('hlrace')
    .from('zone_inventory')
    .select('*')
    .eq('zone_id', zoneId)
    .is('deleted_at', null)
    .order('item_name');
  if (error) { console.error('getInventoryByZone:', error); return []; }
  return (data ?? []) as ZoneInventory[];
}

export async function getLowStockItems(raceId: string): Promise<ZoneInventory[]> {
  const all = await getInventoryByRace(raceId);
  return all.filter(i =>
    i.qty_received > 0 &&
    (i.qty_current / i.qty_received * 100) < i.alert_threshold
  );
}

// ── TRANSPORT ──────────────────────────────────────────────────

export async function getTransportRequests(raceId: string): Promise<TransportRequest[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .schema('hlrace')
    .from('transport_requests')
    .select('*')
    .eq('race_id', raceId)
    .is('deleted_at', null)
    .order('pickup_time', { ascending: true, nullsFirst: false });
  if (error) { console.error('getTransportRequests:', error); return []; }
  return (data ?? []) as TransportRequest[];
}
