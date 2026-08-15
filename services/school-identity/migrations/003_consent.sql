-- Consent artefacts (APAAR / DPDP / biometric / photo / transport_gps)

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('apaar', 'dpdp_processing', 'biometric', 'photo', 'transport_gps')),
  state TEXT NOT NULL CHECK (state IN ('granted', 'refused', 'withdrawn', 'not_sought')),
  granted_by_guardian_id TEXT,
  artefact_ref TEXT,
  verification_method TEXT CHECK (
    verification_method IS NULL OR verification_method IN (
      'existing_records', 'id_details', 'virtual_token', 'digilocker'
    )
  ),
  noted_by TEXT,
  state_changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, student_id, kind)
);

CREATE TABLE IF NOT EXISTS consent_audit (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  consent_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_consents_tenant_student ON consents(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_consent_audit_consent ON consent_audit(tenant_id, consent_id);
