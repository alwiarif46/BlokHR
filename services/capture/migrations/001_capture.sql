-- Capture enrolments, events, devices, match audit. Templates encrypted at rest.

CREATE TABLE IF NOT EXISTS enrolments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject_ref TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK(subject_type IN ('staff','student','visitor')),
  modality TEXT NOT NULL CHECK(modality IN ('fingerprint','face','iris','nfc','qr','bus_rfid')),
  algo TEXT NOT NULL DEFAULT '',
  payload_ciphertext TEXT NOT NULL,
  quality INTEGER NOT NULL DEFAULT 0,
  device_id TEXT NOT NULL DEFAULT '',
  consent_ref TEXT NOT NULL DEFAULT '',
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_enrol_subject ON enrolments(tenant_id, subject_ref, modality);
CREATE INDEX IF NOT EXISTS idx_enrol_modality ON enrolments(tenant_id, modality, revoked_at);

CREATE TABLE IF NOT EXISTS capture_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  modality TEXT NOT NULL,
  subject_ref TEXT NOT NULL DEFAULT '',
  subject_type TEXT NOT NULL DEFAULT '',
  decision TEXT NOT NULL,
  match_score REAL NOT NULL DEFAULT 0,
  device_id TEXT NOT NULL DEFAULT '',
  context_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL,
  override_by TEXT NOT NULL DEFAULT '',
  override_reason TEXT NOT NULL DEFAULT '',
  captured_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_events_device ON capture_events(tenant_id, device_id, captured_at);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS match_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  actor_email TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  enrolment_id TEXT NOT NULL DEFAULT '',
  event_id TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tenant_crypto_keys (
  tenant_id TEXT PRIMARY KEY,
  key_hex TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tenant_jurisdiction (
  tenant_id TEXT PRIMARY KEY,
  country TEXT NOT NULL DEFAULT 'IN',
  state TEXT NOT NULL DEFAULT '',
  vertical TEXT NOT NULL DEFAULT 'hr' CHECK(vertical IN ('hr','school')),
  face_adults_enabled INTEGER NOT NULL DEFAULT 0,
  face_students_dpia_ref TEXT NOT NULL DEFAULT '',
  retention_days INTEGER NOT NULL DEFAULT 365,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
