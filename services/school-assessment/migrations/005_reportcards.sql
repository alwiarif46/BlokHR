-- Report card templates + generated snapshots

CREATE TABLE IF NOT EXISTS report_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  label TEXT NOT NULL,
  board_format TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'sandbox',
  definition_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  promoted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_report_templates_tenant_label
  ON report_templates(tenant_id, label, state);

CREATE TABLE IF NOT EXISTS report_cards (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  academic_session_ref TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  generated_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_cards_student_session
  ON report_cards(tenant_id, student_id, academic_session_ref);
