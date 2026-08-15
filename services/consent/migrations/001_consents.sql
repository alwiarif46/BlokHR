-- Consent artefacts for biometric enrolment (fingerprint | face | iris).

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject_ref TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK(subject_type IN ('staff','student','visitor')),
  modality TEXT NOT NULL CHECK(modality IN ('fingerprint','face','iris','nfc','qr','bus_rfid')),
  legal_basis TEXT NOT NULL DEFAULT 'employment',
  guardian_ref TEXT NOT NULL DEFAULT '',
  dpia_ref TEXT NOT NULL DEFAULT '',
  alternative_acknowledged INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_consents_subject ON consents(tenant_id, subject_ref);
CREATE INDEX IF NOT EXISTS idx_consents_active ON consents(tenant_id, modality, revoked_at);
