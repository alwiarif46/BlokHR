-- Attendance records, audit trail, and tenant settings

CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  date TEXT NOT NULL,
  period_instance_id TEXT,
  session_part TEXT,
  status TEXT NOT NULL,
  excuse TEXT NOT NULL DEFAULT 'unknown',
  reason_code_id TEXT,
  late_minutes INTEGER,
  marked_by TEXT,
  marked_at TEXT,
  source TEXT,
  device_id TEXT,
  idempotency_key TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_tenant_date
  ON attendance_records(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student
  ON attendance_records(tenant_id, student_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_records_slot
  ON attendance_records(
    tenant_id,
    student_id,
    date,
    COALESCE(period_instance_id, ''),
    COALESCE(session_part, '')
  );
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_records_idempotency
  ON attendance_records(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS attendance_audit (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  actor TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attendance_audit_record
  ON attendance_audit(tenant_id, record_id);

CREATE TABLE IF NOT EXISTS attendance_settings (
  tenant_id TEXT PRIMARY KEY,
  granularity TEXT NOT NULL DEFAULT 'day',
  edit_window_minutes INTEGER NOT NULL DEFAULT 120,
  late_threshold_minutes INTEGER NOT NULL DEFAULT 30,
  half_day_min_minutes INTEGER NOT NULL DEFAULT 180,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
