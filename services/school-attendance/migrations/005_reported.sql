-- Parent-reported absences (metadata only, never file bytes)

CREATE TABLE IF NOT EXISTS reported_absences (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  reported_by_guardian_id TEXT NOT NULL,
  dates_json TEXT NOT NULL,
  reason_code_id TEXT NOT NULL,
  note TEXT,
  attachment_ref TEXT,
  channel TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reported_absences_student
  ON reported_absences(tenant_id, student_id);

CREATE INDEX IF NOT EXISTS idx_reported_absences_guardian
  ON reported_absences(tenant_id, student_id, reported_by_guardian_id);
