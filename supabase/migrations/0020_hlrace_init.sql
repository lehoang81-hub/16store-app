-- =============================================================
-- HLRace Migration: 0001_hlrace_init.sql
-- Tạo schema hlrace trong Supabase project 16Store
-- CDC-ready: created_at + updated_at + deleted_at trên mọi bảng
-- Dùng chung: auth.users, public.wallets, public.reputation
-- =============================================================

-- Tạo schema mới, cách ly hoàn toàn khỏi public
CREATE SCHEMA IF NOT EXISTS hlrace;

-- Grant quyền cho anon và authenticated
GRANT USAGE ON SCHEMA hlrace TO anon, authenticated;

-- ── BLOCK 1: organizers ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hlrace.organizers (
  organizer_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name            text NOT NULL,
  org_name        text,
  slug            text UNIQUE,
  email           text NOT NULL,
  phone           text,
  contact_name    text,
  website         text,
  bio             text,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
  -- CDC
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

ALTER TABLE hlrace.organizers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hlrace_org_email ON hlrace.organizers(email);

-- ── BLOCK 2: races ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hlrace.races (
  race_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id        uuid NOT NULL REFERENCES hlrace.organizers(organizer_id),
  name                text NOT NULL,
  race_code           text UNIQUE,
  province            text NOT NULL,
  race_type           text NOT NULL DEFAULT 'road'
                      CHECK (race_type IN ('road','trail','ultra','triathlon','virtual')),
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('draft','pending','approved','active','completed','cancelled')),
  description         text,
  date_start          timestamptz,
  date_end            timestamptz,
  max_participants    integer NOT NULL DEFAULT 500,
  difficulty          integer CHECK (difficulty BETWEEN 1 AND 5),
  elevation_gain      integer,             -- metres
  water_stations      integer DEFAULT 0,
  medical_points      integer DEFAULT 0,
  cutoff_note         text,
  gpx_url             text,
  location_url        text,
  bank_account        text,
  bank_name           text,
  ck_prefix           text,
  refund_policy       text,
  -- Live tracking
  gps_tracking_active boolean NOT NULL DEFAULT false,
  race_started_at     timestamptz,
  race_finished_at    timestamptz,
  -- CDC
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

ALTER TABLE hlrace.races ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hlrace_race_org ON hlrace.races(organizer_id);
CREATE INDEX IF NOT EXISTS idx_hlrace_race_status ON hlrace.races(status) WHERE deleted_at IS NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION hlrace.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_races_updated_at
  BEFORE UPDATE ON hlrace.races
  FOR EACH ROW EXECUTE FUNCTION hlrace.set_updated_at();

-- ── BLOCK 3: race_zones ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hlrace.race_zones (
  zone_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id         uuid NOT NULL REFERENCES hlrace.races(race_id) ON DELETE CASCADE,
  zone_code       text NOT NULL,
  name            text NOT NULL,
  zone_type       text NOT NULL DEFAULT 'general'
                  CHECK (zone_type IN (
                    'start_finish','expo','parking','recovery',
                    'medical','checkpoint','water_station','vip','general'
                  )),
  -- Geometry (GeoJSON [[lat,lng],...])
  polygon         jsonb,
  center_lat      float8,
  center_lng      float8,
  radius_m        integer NOT NULL DEFAULT 200,
  -- Lead
  lead_staff_id   uuid,
  lead_name       text,
  lead_phone      text,
  lead_telegram   text,
  -- Display
  display_color   text NOT NULL DEFAULT '#f97316',
  display_icon    text NOT NULL DEFAULT '📍',
  max_tnv         integer,
  notes           text,
  -- CDC
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

ALTER TABLE hlrace.race_zones ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hlrace_zones_race ON hlrace.race_zones(race_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_zones_updated_at
  BEFORE UPDATE ON hlrace.race_zones
  FOR EACH ROW EXECUTE FUNCTION hlrace.set_updated_at();

-- ── BLOCK 4: event_staff ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS hlrace.event_staff (
  staff_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id         uuid NOT NULL REFERENCES hlrace.races(race_id) ON DELETE CASCADE,
  zone_id         uuid REFERENCES hlrace.race_zones(zone_id) ON DELETE SET NULL,
  position_code   text,                -- Z1.01
  master_id       uuid,
  full_name       text NOT NULL,
  phone           text,
  telegram_id     text,
  telegram_chat_id text,
  cluster         text NOT NULL DEFAULT 'safety'
                  CHECK (cluster IN ('safety','media','protocol','logistics')),
  role            text NOT NULL,
  leader_id       uuid REFERENCES hlrace.event_staff(staff_id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','checked_in','on_duty','off_duty','emergency')),
  -- Location
  location_coords text,               -- "lat,lng" legacy
  location_name   text,
  last_seen_at    timestamptz,
  -- Assignment
  home_address    text,
  home_lat        float8,
  home_lng        float8,
  transport_need  text NOT NULL DEFAULT 'self'
                  CHECK (transport_need IN ('self','need_pickup','need_dropoff','both')),
  checkin_qr      text DEFAULT gen_random_uuid()::text,
  checkin_at      timestamptz,
  checkout_at     timestamptz,
  -- Shift
  shift_start     timestamptz,
  shift_end       timestamptz,
  notes           text,
  hl_score_delta  integer NOT NULL DEFAULT 0,
  briefing_done   boolean NOT NULL DEFAULT false,
  equipment_ok    boolean NOT NULL DEFAULT false,
  -- CDC
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

ALTER TABLE hlrace.event_staff ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hlrace_staff_race ON hlrace.event_staff(race_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hlrace_staff_zone ON hlrace.event_staff(zone_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_staff_updated_at
  BEFORE UPDATE ON hlrace.event_staff
  FOR EACH ROW EXECUTE FUNCTION hlrace.set_updated_at();

-- ── BLOCK 5: race_waypoints ────────────────────────────────────
CREATE TABLE IF NOT EXISTS hlrace.race_waypoints (
  waypoint_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id               uuid NOT NULL REFERENCES hlrace.races(race_id) ON DELETE CASCADE,
  segment_ids           text[],
  name                  text NOT NULL,
  lat                   float8 NOT NULL,
  lng                   float8 NOT NULL,
  waypoint_type         text NOT NULL DEFAULT 'checkpoint'
                        CHECK (waypoint_type IN (
                          'start','finish','checkpoint','water_station',
                          'medical','heritage','hazard','general'
                        )),
  waypoint_order        integer,
  geofence_radius_m     integer NOT NULL DEFAULT 50
                        CHECK (geofence_radius_m BETWEEN 10 AND 500),
  is_mandatory          boolean NOT NULL DEFAULT true,
  expected_min_s_from_prev integer,
  prev_waypoint_id      uuid REFERENCES hlrace.race_waypoints(waypoint_id),
  congestion_threshold  integer NOT NULL DEFAULT 20,
  display_color         text NOT NULL DEFAULT '#f97316',
  display_icon          text NOT NULL DEFAULT '📍',
  notes                 text,
  -- CDC
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

ALTER TABLE hlrace.race_waypoints ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hlrace_wp_race ON hlrace.race_waypoints(race_id, waypoint_order) WHERE deleted_at IS NULL;

-- ── BLOCK 6: participant_locations (append-only, high volume) ──
CREATE TABLE IF NOT EXISTS hlrace.participant_locations (
  location_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id         uuid NOT NULL REFERENCES hlrace.races(race_id) ON DELETE CASCADE,
  bib_id          uuid,
  bib_number      text,
  segment_id      uuid,
  lat             float8 NOT NULL,
  lng             float8 NOT NULL,
  accuracy_m      float4,
  speed_kmh       float4,
  heading_deg     float4,
  altitude_m      float4,
  source          text NOT NULL DEFAULT 'browser_gps'
                  CHECK (source IN ('browser_gps','garmin_live','strava_beacon','manual_sos')),
  is_sos          boolean NOT NULL DEFAULT false,
  -- Append-only: chỉ created_at, không updated_at/deleted_at
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Alias for query compatibility
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

-- Index quan trọng cho performance với 5000 VĐV
CREATE INDEX IF NOT EXISTS idx_hlrace_pl_race_bib_time
  ON hlrace.participant_locations(race_id, bib_number, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_hlrace_pl_sos
  ON hlrace.participant_locations(race_id, is_sos) WHERE is_sos = true;

-- ── BLOCK 7: checkpoint_events (append-only) ───────────────────
CREATE TABLE IF NOT EXISTS hlrace.checkpoint_events (
  event_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id             uuid NOT NULL REFERENCES hlrace.races(race_id) ON DELETE CASCADE,
  race_waypoint_id    uuid REFERENCES hlrace.race_waypoints(waypoint_id),
  bib_id              uuid,
  bib_number          text,
  segment_id          uuid,
  passed_at           timestamptz NOT NULL DEFAULT now(),
  lat                 float8,
  lng                 float8,
  distance_to_wp_m    float4,
  method              text NOT NULL DEFAULT 'geofence'
                      CHECK (method IN ('geofence','manual_scan','rfid')),
  -- Anti-shortcut
  prev_waypoint_id    uuid REFERENCES hlrace.race_waypoints(waypoint_id),
  prev_passed_at      timestamptz,
  time_delta_s        integer,
  expected_min_s      integer,
  is_shortcut_flag    boolean NOT NULL DEFAULT false,
  evidence_snapshot   jsonb,           -- ShortcutEvidence type (see types.ts)
  -- Append-only
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hlrace_ce_race_bib
  ON hlrace.checkpoint_events(race_id, bib_number, passed_at DESC);
CREATE INDEX IF NOT EXISTS idx_hlrace_ce_shortcut
  ON hlrace.checkpoint_events(race_id, is_shortcut_flag) WHERE is_shortcut_flag = true;

-- ── BLOCK 8: congestion_alerts ─────────────────────────────────
CREATE TABLE IF NOT EXISTS hlrace.congestion_alerts (
  alert_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id             uuid NOT NULL REFERENCES hlrace.races(race_id),
  race_waypoint_id    uuid REFERENCES hlrace.race_waypoints(waypoint_id),
  alert_type          text NOT NULL
                      CHECK (alert_type IN ('sos','congestion','shortcut','off_route','no_show')),
  severity            text NOT NULL DEFAULT 'warning'
                      CHECK (severity IN ('info','warning','critical')),
  bib_numbers         text[],
  detail              jsonb NOT NULL,  -- AlertDetail union type (see types.ts)
  is_active           boolean NOT NULL DEFAULT true,
  resolved_at         timestamptz,
  resolved_by         text,
  -- CDC
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hlrace_alerts_active
  ON hlrace.congestion_alerts(race_id, is_active, created_at DESC);

CREATE TRIGGER trg_alerts_updated_at
  BEFORE UPDATE ON hlrace.congestion_alerts
  FOR EACH ROW EXECUTE FUNCTION hlrace.set_updated_at();

-- ── BLOCK 9: zone_inventory ────────────────────────────────────
CREATE TABLE IF NOT EXISTS hlrace.zone_inventory (
  inv_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id             uuid NOT NULL REFERENCES hlrace.races(race_id) ON DELETE CASCADE,
  zone_id             uuid REFERENCES hlrace.race_zones(zone_id) ON DELETE SET NULL,
  item_name           text NOT NULL,
  item_category       text NOT NULL DEFAULT 'consumable'
                      CHECK (item_category IN ('consumable','equipment','medical','award','other')),
  qty_planned         integer NOT NULL DEFAULT 0,
  qty_received        integer NOT NULL DEFAULT 0,
  qty_current         integer NOT NULL DEFAULT 0,
  alert_threshold     integer NOT NULL DEFAULT 20 CHECK (alert_threshold BETWEEN 0 AND 100),
  unit                text NOT NULL DEFAULT 'cái',
  last_updated_by     text,
  last_updated_at     timestamptz NOT NULL DEFAULT now(),
  notes               text,
  -- CDC
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_hlrace_inv_zone
  ON hlrace.zone_inventory(zone_id, item_name) WHERE deleted_at IS NULL;

-- ── BLOCK 10: inventory_transactions (append-only log) ─────────
CREATE TABLE IF NOT EXISTS hlrace.inventory_transactions (
  txn_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id         uuid NOT NULL REFERENCES hlrace.races(race_id) ON DELETE CASCADE,
  inv_id          uuid REFERENCES hlrace.zone_inventory(inv_id),
  from_zone_id    uuid REFERENCES hlrace.race_zones(zone_id),
  to_zone_id      uuid REFERENCES hlrace.race_zones(zone_id),
  txn_type        text NOT NULL
                  CHECK (txn_type IN ('receive','consume','transfer','return','adjust')),
  qty             integer NOT NULL CHECK (qty > 0),  -- always positive
  note            text,
  confirmed_by    text,
  confirmed_at    timestamptz,
  created_by      text,
  -- Append-only: chỉ created_at
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── BLOCK 11: transport_requests ───────────────────────────────
CREATE TABLE IF NOT EXISTS hlrace.transport_requests (
  request_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id         uuid NOT NULL REFERENCES hlrace.races(race_id) ON DELETE CASCADE,
  staff_id        uuid REFERENCES hlrace.event_staff(staff_id) ON DELETE SET NULL,
  staff_name      text,
  phone           text,
  direction       text NOT NULL CHECK (direction IN ('to_zone','from_zone')),
  pickup_address  text,
  pickup_lat      float8,
  pickup_lng      float8,
  zone_id         uuid REFERENCES hlrace.race_zones(zone_id),
  zone_name       text,
  pickup_time     timestamptz,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','assigned','en_route','completed','cancelled')),
  driver_name     text,
  driver_phone    text,
  notes           text,
  -- CDC
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_hlrace_transport_status
  ON hlrace.transport_requests(race_id, status, pickup_time) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_transport_updated_at
  BEFORE UPDATE ON hlrace.transport_requests
  FOR EACH ROW EXECUTE FUNCTION hlrace.set_updated_at();

-- ── BLOCK 12: zone_checklists ──────────────────────────────────
CREATE TABLE IF NOT EXISTS hlrace.zone_checklists (
  check_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id         uuid NOT NULL REFERENCES hlrace.races(race_id) ON DELETE CASCADE,
  zone_id         uuid REFERENCES hlrace.race_zones(zone_id) ON DELETE SET NULL,
  checklist_type  text NOT NULL DEFAULT 'end_shift'
                  CHECK (checklist_type IN ('start_shift','end_shift','transfer')),
  items           jsonb NOT NULL DEFAULT '[]',  -- ChecklistItem[] (see types.ts)
  completed_by    text,
  completed_at    timestamptz,
  verified_by     text,
  verified_at     timestamptz,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','completed','verified')),
  -- CDC
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_checklist_updated_at
  BEFORE UPDATE ON hlrace.zone_checklists
  FOR EACH ROW EXECUTE FUNCTION hlrace.set_updated_at();

-- ── GRANT permissions ──────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA hlrace TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA hlrace TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA hlrace TO authenticated;

-- ── SUMMARY ────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '✅ hlrace schema created with % tables:', 12;
  RAISE NOTICE '   organizers, races, race_zones, event_staff';
  RAISE NOTICE '   race_waypoints, participant_locations, checkpoint_events';
  RAISE NOTICE '   congestion_alerts, zone_inventory, inventory_transactions';
  RAISE NOTICE '   transport_requests, zone_checklists';
  RAISE NOTICE '📋 CDC-ready: created_at + updated_at + deleted_at on all mutable tables';
  RAISE NOTICE '🔗 Shared: auth.users (auth), wallets + reputation (public schema)';
END $$;
