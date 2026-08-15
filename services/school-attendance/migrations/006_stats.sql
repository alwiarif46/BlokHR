-- Monthly statutory rollups + day derivation setting

CREATE TABLE IF NOT EXISTS attendance_monthly_rollups (
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  month TEXT NOT NULL,
  working_days INTEGER NOT NULL,
  present_days INTEGER NOT NULL,
  absent_days INTEGER NOT NULL,
  late_count INTEGER NOT NULL,
  pct REAL NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, student_id, month)
);

CREATE INDEX IF NOT EXISTS idx_attendance_rollups_month
  ON attendance_monthly_rollups(tenant_id, month);

CREATE INDEX IF NOT EXISTS idx_attendance_rollups_student
  ON attendance_monthly_rollups(tenant_id, student_id);

ALTER TABLE attendance_settings ADD COLUMN day_derivation TEXT NOT NULL DEFAULT 'majority';
