-- NFC/QR capture bindings and gate events (hashes only — never raw payloads)

CREATE TABLE IF NOT EXISTS capture_bindings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  modality TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_capture_bindings_active_hash
  ON capture_bindings(tenant_id, modality, payload_hash)
  WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS idx_capture_bindings_subject
  ON capture_bindings(tenant_id, subject_type, subject_id);

CREATE TABLE IF NOT EXISTS capture_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  modality TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  matched_subject_id TEXT,
  decision TEXT NOT NULL,
  context_json TEXT NOT NULL,
  idempotency_key TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_capture_events_tenant_at
  ON capture_events(tenant_id, at);
CREATE INDEX IF NOT EXISTS idx_capture_events_hash
  ON capture_events(tenant_id, payload_hash, at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_capture_events_idempotency
  ON capture_events(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
