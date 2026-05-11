// =============================================================
// HLRACE — TypeScript Types
// Chuẩn BigQuery/CDC: timestamps ISO 8601, soft delete, strict JSON
// Schema: hlrace (cách ly khỏi public schema của 16Store)
// Shared: auth.users.id, wallets, reputation từ 16Store
// =============================================================

// ── ENUMS ─────────────────────────────────────────────────────

export type RaceStatus = 'draft' | 'pending' | 'approved' | 'active' | 'completed' | 'cancelled';
export type RaceType = 'road' | 'trail' | 'ultra' | 'triathlon' | 'virtual';

export type StaffCluster = 'safety' | 'media' | 'protocol' | 'logistics';
export type StaffRole =
  | 'volunteer' | 'medical' | 'security'
  | 'nag' | 'kol' | 'press' | 'media'
  | 'vip' | 'government' | 'fb'
  | 'partner' | 'sponsor' | 'logistics';
export type StaffStatus = 'pending' | 'checked_in' | 'on_duty' | 'off_duty' | 'emergency';
export type TransportNeed = 'self' | 'need_pickup' | 'need_dropoff' | 'both';

export type ZoneType =
  | 'start_finish' | 'expo' | 'parking' | 'recovery'
  | 'medical' | 'checkpoint' | 'water_station' | 'vip' | 'general';

export type WaypointType =
  | 'start' | 'finish' | 'checkpoint' | 'water_station'
  | 'medical' | 'heritage' | 'hazard' | 'general';

export type AlertType = 'sos' | 'congestion' | 'shortcut' | 'off_route' | 'no_show';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export type GpsSource = 'browser_gps' | 'garmin_live' | 'strava_beacon' | 'manual_sos';
export type CheckpointMethod = 'geofence' | 'manual_scan' | 'rfid';

export type InventoryCategory = 'consumable' | 'equipment' | 'medical' | 'award' | 'other';
export type TxnType = 'receive' | 'consume' | 'transfer' | 'return' | 'adjust';
export type TransportStatus = 'pending' | 'assigned' | 'en_route' | 'completed' | 'cancelled';
export type ChecklistType = 'start_shift' | 'end_shift' | 'transfer';
export type ChecklistStatus = 'pending' | 'completed' | 'verified';

// ── CORE MODELS ───────────────────────────────────────────────

export interface Race {
  race_id: string;                     // uuid
  organizer_id: string;                // uuid → hlrace.organizers
  name: string;
  race_code: string;
  province: string;
  race_type: RaceType;
  status: RaceStatus;
  description: string | null;
  date_start: string | null;           // ISO 8601
  date_end: string | null;             // ISO 8601
  max_participants: number;
  difficulty: number;                  // 1-5
  elevation_gain: number | null;       // metres, integer
  water_stations: number;
  medical_points: number;
  cutoff_note: string | null;
  gpx_url: string | null;
  location_url: string | null;
  bank_account: string | null;
  bank_name: string | null;
  ck_prefix: string | null;
  refund_policy: string | null;
  // Live tracking
  gps_tracking_active: boolean;
  race_started_at: string | null;      // ISO 8601
  race_finished_at: string | null;     // ISO 8601
  // CDC-ready timestamps
  created_at: string;                  // ISO 8601
  updated_at: string;                  // ISO 8601
  deleted_at: string | null;           // soft delete
}

export interface RaceZone {
  zone_id: string;
  race_id: string;
  zone_code: string;                   // Z1, Z2...
  name: string;
  zone_type: ZoneType;
  // Geometry — GeoJSON polygon [[lat,lng],...]
  polygon: ZonePolygonPoint[] | null;
  center_lat: number | null;
  center_lng: number | null;
  radius_m: number;
  // Lead
  lead_staff_id: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  lead_telegram: string | null;
  // Display
  display_color: string;
  display_icon: string;
  max_tnv: number | null;
  notes: string | null;
  // CDC timestamps
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ZonePolygonPoint {
  lat: number;
  lng: number;
}

export interface EventStaff {
  staff_id: string;
  race_id: string;
  zone_id: string | null;
  position_code: string | null;        // Z1.01
  master_id: string | null;
  full_name: string;
  phone: string | null;
  telegram_id: string | null;
  telegram_chat_id: string | null;
  cluster: StaffCluster;
  role: StaffRole;
  leader_id: string | null;
  status: StaffStatus;
  // Location
  location_coords: string | null;      // "lat,lng" legacy format
  location_name: string | null;
  last_seen_at: string | null;         // ISO 8601
  // Assignment
  home_address: string | null;
  home_lat: number | null;
  home_lng: number | null;
  transport_need: TransportNeed;
  checkin_qr: string | null;
  checkin_at: string | null;           // ISO 8601
  checkout_at: string | null;          // ISO 8601
  // Shift
  shift_start: string | null;          // ISO 8601
  shift_end: string | null;            // ISO 8601
  notes: string | null;
  hl_score_delta: number;
  briefing_done: boolean;
  equipment_ok: boolean;
  // CDC timestamps
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RaceWaypoint {
  waypoint_id: string;
  race_id: string;
  name: string;
  lat: number;
  lng: number;
  waypoint_type: WaypointType;
  waypoint_order: number | null;
  geofence_radius_m: number;
  is_mandatory: boolean;
  expected_min_s_from_prev: number | null;  // seconds
  prev_waypoint_id: string | null;
  congestion_threshold: number;
  segment_ids: string[] | null;
  display_color: string;
  display_icon: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ── GPS & TRACKING ────────────────────────────────────────────

export interface ParticipantLocation {
  location_id: string;
  race_id: string;
  bib_id: string | null;
  bib_number: string | null;
  segment_id: string | null;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  speed_kmh: number | null;
  heading_deg: number | null;
  altitude_m: number | null;
  recorded_at: string;                 // ISO 8601
  source: GpsSource;
  is_sos: boolean;
  // No updated_at/deleted_at — append-only time series
  created_at: string;
}

export interface CheckpointEvent {
  event_id: string;
  race_id: string;
  race_waypoint_id: string | null;
  waypoint_id: string | null;          // legacy
  bib_id: string | null;
  bib_number: string | null;
  segment_id: string | null;
  passed_at: string;                   // ISO 8601
  lat: number | null;
  lng: number | null;
  distance_to_wp_m: number | null;
  method: CheckpointMethod;
  // Anti-shortcut evidence
  prev_waypoint_id: string | null;
  prev_passed_at: string | null;       // ISO 8601
  time_delta_s: number | null;
  expected_min_s: number | null;
  is_shortcut_flag: boolean;
  evidence_snapshot: ShortcutEvidence | null;  // strict typed JSONB
  created_at: string;
}

// Strict JSONB type cho evidence — không dùng Record<string,unknown>
export interface ShortcutEvidence {
  violation: string;
  bib: string;
  km5_passed_at: string;              // ISO 8601
  km10_passed_at: string;             // ISO 8601
  elapsed_minutes: number;            // number, not string
  min_required_min: number;
  skipped_waypoints: string[];
  gps_trail_missing: boolean;
  gps_trail?: GpsTrailPoint[];
}

export interface GpsTrailPoint {
  lat: number;
  lng: number;
  recorded_at: string;                // ISO 8601
}

// ── ALERTS ────────────────────────────────────────────────────

export interface CongestionAlert {
  alert_id: string;
  race_id: string;
  race_waypoint_id: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  bib_numbers: string[] | null;
  detail: AlertDetail;                 // strict typed JSONB
  created_at: string;                  // ISO 8601
  resolved_at: string | null;
  resolved_by: string | null;
  is_active: boolean;
  // CDC
  updated_at: string;
}

// Union type cho alert detail — type-safe JSONB
export type AlertDetail =
  | CongestionAlertDetail
  | ShortcutAlertDetail
  | SosAlertDetail
  | OffRouteAlertDetail;

export interface CongestionAlertDetail {
  type: 'congestion';
  location: string;
  count_per_min: number;              // number
  threshold: number;                  // number
  message: string;
  recommendation: string;
}

export interface ShortcutAlertDetail {
  type: 'shortcut';
  bib: string;
  skipped: string;
  time_saved_min: number;             // number
  evidence: string;
}

export interface SosAlertDetail {
  type: 'sos';
  bib: string;
  last_lat: number;                   // number
  last_lng: number;                   // number
  message: string;
  nearest_staff: string;
  distance_to_staff_m: number;        // number
}

export interface OffRouteAlertDetail {
  type: 'off_route';
  bib: string;
  deviation_m: number;                // number
  last_known_lat: number;
  last_known_lng: number;
}

// ── INVENTORY ─────────────────────────────────────────────────

export interface ZoneInventory {
  inv_id: string;
  race_id: string;
  zone_id: string | null;
  item_name: string;
  item_category: InventoryCategory;
  qty_planned: number;                 // integer
  qty_received: number;                // integer
  qty_current: number;                 // integer
  qty_used: number;                    // computed: received - current
  alert_threshold: number;             // percentage 0-100
  unit: string;
  last_updated_by: string | null;
  last_updated_at: string;             // ISO 8601
  notes: string | null;
  // CDC
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface InventoryTransaction {
  txn_id: string;
  race_id: string;
  inv_id: string | null;
  from_zone_id: string | null;
  to_zone_id: string | null;
  txn_type: TxnType;
  qty: number;                         // integer, always positive
  note: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;         // ISO 8601
  created_by: string | null;
  created_at: string;                  // ISO 8601
  // Append-only — no updated_at/deleted_at
}

// ── TRANSPORT ─────────────────────────────────────────────────

export interface TransportRequest {
  request_id: string;
  race_id: string;
  staff_id: string | null;
  staff_name: string | null;
  phone: string | null;
  direction: 'to_zone' | 'from_zone';
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  zone_id: string | null;
  zone_name: string | null;
  pickup_time: string | null;          // ISO 8601
  status: TransportStatus;
  driver_name: string | null;
  driver_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ── CHECKLIST ─────────────────────────────────────────────────

export interface ChecklistItem {
  label: string;
  type: 'checkbox' | 'number' | 'text' | 'textarea';
  value: boolean | number | string | null;
  required: boolean;
}

export interface ZoneChecklist {
  check_id: string;
  race_id: string;
  zone_id: string | null;
  checklist_type: ChecklistType;
  items: ChecklistItem[];              // strict typed JSONB array
  completed_by: string | null;
  completed_at: string | null;         // ISO 8601
  verified_by: string | null;
  verified_at: string | null;          // ISO 8601
  status: ChecklistStatus;
  created_at: string;
  updated_at: string;
}

// ── AGGREGATED VIEW TYPES (for UI) ────────────────────────────

export interface ZoneWithStats extends RaceZone {
  staff: EventStaff[];
  staff_on_duty: number;
  staff_checked_in: number;
  staff_need_transport: number;
  inventory: ZoneInventory[];
  low_stock_count: number;
  active_alerts: CongestionAlert[];
}

export interface LiveMapData {
  staff: EventStaff[];
  vdv_latest: ParticipantLocation[];  // deduplicated — 1 per bib
  waypoints: RaceWaypoint[];
  zones: RaceZone[];
  alerts: CongestionAlert[];
  sos: ParticipantLocation[];
  stats: LiveMapStats;
}

export interface LiveMapStats {
  staff_total: number;
  staff_on_duty: number;
  staff_gps: number;
  vdv_tracked: number;
  vdv_sos: number;
  alert_count: number;
  critical_count: number;
  race_elapsed_s: number | null;       // seconds since race_started_at
}
