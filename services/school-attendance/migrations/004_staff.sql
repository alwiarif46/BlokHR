-- Staff attendance + monthly finalize locks

CREATE TABLE IF NOT EXISTS staff_attendance (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  date TEXT NOT NULL,
  check_in_at TEXT,
  check_out_at TEXT,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  minutes_on_premises INTEGER,
  marked_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_attendance_day
  ON staff_attendance(tenant_id, member_id, date);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_month
  ON staff_attendance(tenant_id, date);

CREATE TABLE IF NOT EXISTS staff_locks (
  tenant_id TEXT NOT NULL,
  month TEXT NOT NULL,
  finalized_at TEXT NOT NULL DEFAULT (datetime('now')),
  finalized_by TEXT,
  PRIMARY KEY (tenant_id, month)
);
