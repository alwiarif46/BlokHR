-- Export run history (validated files only — no portal auto-submit)

CREATE TABLE IF NOT EXISTS export_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  academic_session_ref TEXT NOT NULL,
  state TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  passing INTEGER NOT NULL DEFAULT 0,
  failing INTEGER NOT NULL DEFAULT 0,
  file_ref TEXT,
  errors_json TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_export_runs_tenant_kind
  ON export_runs(tenant_id, kind, created_at);
