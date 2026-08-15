-- Marks with draft/assigned split + moderation audit

CREATE TABLE IF NOT EXISTS marks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  draft_marks REAL,
  assigned_marks REAL,
  is_absent INTEGER NOT NULL DEFAULT 0,
  is_exempt INTEGER NOT NULL DEFAULT 0,
  entered_by TEXT NOT NULL,
  moderated_by TEXT,
  published_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marks_exam_student
  ON marks(exam_id, student_id);

CREATE INDEX IF NOT EXISTS idx_marks_tenant_exam
  ON marks(tenant_id, exam_id);

CREATE TABLE IF NOT EXISTS marks_audit (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mark_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  previous_assigned REAL,
  new_assigned REAL NOT NULL,
  moderated_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_marks_audit_mark
  ON marks_audit(tenant_id, mark_id);
