-- Boarding bindings (hash-only) + events + missed-boarding sweep log

CREATE TABLE IF NOT EXISTS transport_bindings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_ref TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transport_bindings_active_hash
  ON transport_bindings(tenant_id, payload_hash)
  WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS idx_transport_bindings_student
  ON transport_bindings(tenant_id, student_ref);

CREATE TABLE IF NOT EXISTS boarding_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  student_ref TEXT,
  direction TEXT NOT NULL,
  leg TEXT NOT NULL,
  at TEXT NOT NULL,
  lat REAL,
  lng REAL,
  source TEXT NOT NULL,
  device_id TEXT,
  idempotency_key TEXT,
  unmatched INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_boarding_events_idempotency
  ON boarding_events(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_boarding_events_route_day
  ON boarding_events(tenant_id, route_id, at);

CREATE INDEX IF NOT EXISTS idx_boarding_events_student_day
  ON boarding_events(tenant_id, student_ref, at);

CREATE TABLE IF NOT EXISTS sweep_log (
  tenant_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  leg TEXT NOT NULL,
  sweep_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, route_id, leg, sweep_date)
);
