-- School roll call: classes, periods, roster, marks. Offline-first sync.

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(tenant_id, class_id);

CREATE TABLE IF NOT EXISTS periods (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  label TEXT NOT NULL,
  period_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_periods_class_date ON periods(tenant_id, class_id, period_date);

CREATE TABLE IF NOT EXISTS marks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  period_id TEXT NOT NULL,
  subject_ref TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('present','absent','late')),
  source TEXT NOT NULL DEFAULT 'roll_call',
  idempotency_key TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, period_id, subject_ref),
  UNIQUE(tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_marks_period ON marks(tenant_id, period_id);

CREATE TABLE IF NOT EXISTS mark_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  period_id TEXT NOT NULL,
  subject_ref TEXT NOT NULL,
  old_status TEXT NOT NULL DEFAULT '',
  new_status TEXT NOT NULL,
  source TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
