-- DPDP data-subject requests (parental access / correction / erasure)

CREATE TABLE IF NOT EXISTS tenant_config (
  tenant_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS data_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_ref TEXT NOT NULL,
  guardian_ref TEXT NOT NULL,
  kind TEXT NOT NULL,
  state TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  sla_due_on TEXT NOT NULL,
  resolution_note TEXT,
  handled_by TEXT,
  overdue_emitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_data_requests_tenant_state
  ON data_requests(tenant_id, state, sla_due_on);

CREATE TABLE IF NOT EXISTS data_request_audit (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  actor TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_data_request_audit_request
  ON data_request_audit(tenant_id, request_id, at);
