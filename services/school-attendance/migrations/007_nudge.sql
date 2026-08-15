-- Attendance nudge config, cohort assignment, and message log

CREATE TABLE IF NOT EXISTS nudge_config (
  tenant_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  at_risk_pct REAL NOT NULL DEFAULT 10,
  chronic_days INTEGER NOT NULL DEFAULT 18,
  holdout_pct INTEGER NOT NULL DEFAULT 10,
  max_messages_per_term INTEGER NOT NULL DEFAULT 6,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS nudge_assignments (
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  cohort TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, student_id)
);

CREATE TABLE IF NOT EXISTS nudge_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  ytd_absent_days INTEGER NOT NULL,
  class_percentile REAL NOT NULL,
  rendered_vars_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_nudge_messages_tenant_student
  ON nudge_messages(tenant_id, student_id, created_at);

CREATE INDEX IF NOT EXISTS idx_nudge_messages_tenant
  ON nudge_messages(tenant_id, created_at);
