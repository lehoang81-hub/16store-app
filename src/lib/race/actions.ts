'use server';
// =============================================================
// HLRACE — Server Actions (mutations)
// CDC-ready: timestamps luôn ISO 8601, soft delete, no raw DELETE
// =============================================================

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
  RaceZone, ZonePolygonPoint, TransportNeed,
  TxnType, ChecklistItem,
} from './types';

// ── ZONES ──────────────────────────────────────────────────────

export interface CreateZoneInput {
  race_id: string;
  zone_code: string;
  name: string;
  zone_type: RaceZone['zone_type'];
  polygon: ZonePolygonPoint[] | null;
  center_lat: number | null;
  center_lng: number | null;
  radius_m: number;
  display_color: string;
  display_icon: string;
  max_tnv: number | null;
  notes: string | null;
}

export async function createZone(input: CreateZoneInput) {
  const sb = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await sb
    .schema('hlrace')
    .from('race_zones')
    .insert({ ...input, created_at: now, updated_at: now })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/race/${input.race_id}/organizer/zone-ops`);
  return data;
}

export async function updateZonePolygon(
  zoneId: string,
  raceId: string,
  polygon: ZonePolygonPoint[],
  centerLat: number,
  centerLng: number,
) {
  const sb = await createClient();
  const { error } = await sb
    .schema('hlrace')
    .from('race_zones')
    .update({
      polygon,
      center_lat: centerLat,
      center_lng: centerLng,
      updated_at: new Date().toISOString(),
    })
    .eq('zone_id', zoneId);
  if (error) throw new Error(error.message);
  revalidatePath(`/race/${raceId}/organizer/zone-ops`);
}

export async function updateZoneLead(
  zoneId: string,
  raceId: string,
  staffId: string,
  staffName: string,
  staffPhone: string | null,
  staffTelegram: string | null,
) {
  const sb = await createClient();
  const { error } = await sb
    .schema('hlrace')
    .from('race_zones')
    .update({
      lead_staff_id: staffId,
      lead_name: staffName,
      lead_phone: staffPhone,
      lead_telegram: staffTelegram,
      updated_at: new Date().toISOString(),
    })
    .eq('zone_id', zoneId);
  if (error) throw new Error(error.message);
  revalidatePath(`/race/${raceId}/organizer/zone-ops`);
}

// Soft delete — không dùng DELETE
export async function deleteZone(zoneId: string, raceId: string) {
  const sb = await createClient();
  const { error } = await sb
    .schema('hlrace')
    .from('race_zones')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('zone_id', zoneId);
  if (error) throw new Error(error.message);
  revalidatePath(`/race/${raceId}/organizer/zone-ops`);
}

// ── STAFF ASSIGNMENT ───────────────────────────────────────────

export async function assignStaffToZone(
  staffId: string,
  raceId: string,
  zoneId: string,
  positionCode: string,
) {
  const sb = await createClient();
  const { error } = await sb
    .schema('hlrace')
    .from('event_staff')
    .update({
      zone_id: zoneId,
      position_code: positionCode,
      updated_at: new Date().toISOString(),
    })
    .eq('staff_id', staffId);
  if (error) throw new Error(error.message);
  revalidatePath(`/race/${raceId}/organizer/zone-ops`);
}

export async function checkInStaff(staffId: string, raceId: string) {
  const sb = await createClient();
  const now = new Date().toISOString();
  const { error } = await sb
    .schema('hlrace')
    .from('event_staff')
    .update({
      status: 'checked_in',
      checkin_at: now,
      updated_at: now,
    })
    .eq('staff_id', staffId);
  if (error) throw new Error(error.message);
  revalidatePath(`/race/${raceId}/organizer/staff`);
}

// ── INVENTORY ──────────────────────────────────────────────────

export async function updateInventoryStock(
  invId: string,
  raceId: string,
  type: TxnType,
  qty: number,                         // always positive integer
  note: string | null,
  updatedBy: string,
) {
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new Error('qty phải là số nguyên dương');
  }

  const sb = await createClient();
  const now = new Date().toISOString();

  // Lấy current stock
  const { data: inv, error: fetchErr } = await sb
    .schema('hlrace')
    .from('zone_inventory')
    .select('qty_current, qty_received, zone_id')
    .eq('inv_id', invId)
    .single();
  if (fetchErr || !inv) throw new Error('Không tìm thấy inventory item');

  // Tính qty mới
  let newQty: number;
  if (type === 'receive') {
    newQty = inv.qty_current + qty;
  } else if (type === 'consume' || type === 'transfer' || type === 'return') {
    newQty = Math.max(0, inv.qty_current - qty);
  } else {
    newQty = qty; // adjust = set absolute
  }

  // Update stock
  const { error: updateErr } = await sb
    .schema('hlrace')
    .from('zone_inventory')
    .update({
      qty_current: newQty,
      last_updated_by: updatedBy,
      last_updated_at: now,
      updated_at: now,
    })
    .eq('inv_id', invId);
  if (updateErr) throw new Error(updateErr.message);

  // Append-only transaction log
  const { error: txnErr } = await sb
    .schema('hlrace')
    .from('inventory_transactions')
    .insert({
      race_id: raceId,
      inv_id: invId,
      to_zone_id: type !== 'transfer' ? inv.zone_id : null,
      from_zone_id: type === 'transfer' ? inv.zone_id : null,
      txn_type: type,
      qty,                             // positive integer
      note,
      created_by: updatedBy,
      created_at: now,
    });
  if (txnErr) console.error('Transaction log failed:', txnErr);

  revalidatePath(`/race/${raceId}/organizer/zone-ops`);
  return { new_qty: newQty };
}

export async function addInventoryItem(
  raceId: string,
  zoneId: string,
  itemName: string,
  qtyPlanned: number,
  unit: string,
  alertThreshold: number,
  addedBy: string,
) {
  if (!Number.isInteger(qtyPlanned) || qtyPlanned <= 0) {
    throw new Error('Số lượng phải là số nguyên dương');
  }
  if (alertThreshold < 0 || alertThreshold > 100) {
    throw new Error('Ngưỡng cảnh báo phải từ 0-100%');
  }

  const sb = await createClient();
  const now = new Date().toISOString();
  const { error } = await sb
    .schema('hlrace')
    .from('zone_inventory')
    .insert({
      race_id: raceId,
      zone_id: zoneId,
      item_name: itemName,
      qty_planned: qtyPlanned,
      qty_received: qtyPlanned,
      qty_current: qtyPlanned,
      alert_threshold: alertThreshold,
      unit,
      last_updated_by: addedBy,
      last_updated_at: now,
      created_at: now,
      updated_at: now,
    });
  if (error) throw new Error(error.message);
  revalidatePath(`/race/${raceId}/organizer/zone-ops`);
}

// ── TRANSPORT ──────────────────────────────────────────────────

export async function assignTransportDriver(
  requestId: string,
  raceId: string,
  driverName: string,
  driverPhone: string,
) {
  const sb = await createClient();
  const now = new Date().toISOString();
  const { error } = await sb
    .schema('hlrace')
    .from('transport_requests')
    .update({
      status: 'assigned',
      driver_name: driverName,
      driver_phone: driverPhone,
      updated_at: now,
    })
    .eq('request_id', requestId);
  if (error) throw new Error(error.message);
  revalidatePath(`/race/${raceId}/organizer/zone-ops`);
}

export async function completeTransport(requestId: string, raceId: string) {
  const sb = await createClient();
  const { error } = await sb
    .schema('hlrace')
    .from('transport_requests')
    .update({
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('request_id', requestId);
  if (error) throw new Error(error.message);
  revalidatePath(`/race/${raceId}/organizer/zone-ops`);
}

// ── ALERTS ─────────────────────────────────────────────────────

export async function resolveAlert(
  alertId: string,
  raceId: string,
  resolvedBy: string,
) {
  const sb = await createClient();
  const now = new Date().toISOString();
  const { error } = await sb
    .schema('hlrace')
    .from('congestion_alerts')
    .update({
      is_active: false,
      resolved_at: now,
      resolved_by: resolvedBy,
      updated_at: now,
    })
    .eq('alert_id', alertId);
  if (error) throw new Error(error.message);
  revalidatePath(`/race/${raceId}/organizer/live-map`);
}

// ── GPS TRACKING ───────────────────────────────────────────────

export async function toggleGpsTracking(raceId: string, active: boolean) {
  const sb = await createClient();
  const { error } = await sb
    .schema('hlrace')
    .from('races')
    .update({
      gps_tracking_active: active,
      updated_at: new Date().toISOString(),
    })
    .eq('race_id', raceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/race/${raceId}/organizer/live-map`);
}

// ── CHECKLIST ──────────────────────────────────────────────────

export async function submitChecklist(
  checkId: string,
  raceId: string,
  items: ChecklistItem[],
  completedBy: string,
) {
  const sb = await createClient();
  const now = new Date().toISOString();
  const { error } = await sb
    .schema('hlrace')
    .from('zone_checklists')
    .update({
      items,                           // strict typed
      status: 'completed',
      completed_by: completedBy,
      completed_at: now,
      updated_at: now,
    })
    .eq('check_id', checkId);
  if (error) throw new Error(error.message);
  revalidatePath(`/race/${raceId}/organizer/zone-ops`);
}
