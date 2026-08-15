-- Bus RFID / transport events (separate legal basis from campus attendance)
CREATE TABLE IF NOT EXISTS transport_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject_ref TEXT NOT NULL,
  route_id TEXT NOT NULL,
  stop_id TEXT NOT NULL,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('board', 'alight')),
  lat REAL,
  lng REAL,
  capture_event_id TEXT,
  consent_ref TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_transport_events_route ON transport_events (tenant_id, route_id, created_at);
