-- 014_overtime: Overtime detection, records, and approval.

-- Salary columns on members for OT pay calculation
ALTER TABLE members ADD COLUMN basic_salary REAL NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN da REAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS overtime_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  date TEXT NOT NULL,
  shift_start TEXT NOT NULL,
  shift_end TEXT NOT NULL,
  actual_worked_minutes REAL NOT NULL DEFAULT 0,
  standard_minutes REAL NOT NULL DEFAULT 0,
  ot_minutes REAL NOT NULL DEFAULT 0,
  ot_type TEXT NOT NULL DEFAULT 'weekday' CHECK(ot_type IN ('weekday', 'weekend', 'holiday')),
  hourly_rate REAL NOT NULL DEFAULT 0,
  multiplier REAL NOT NULL DEFAULT 2,
  ot_pay REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'auto' CHECK(source IN ('auto', 'manual', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT NOT NULL DEFAULT '',
  rejection_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(email, date, ot_type)
);
CREATE INDEX IF NOT EXISTS idx_ot_email ON overtime_records(email);
CREATE INDEX IF NOT EXISTS idx_ot_date ON overtime_records(date);
CREATE INDEX IF NOT EXISTS idx_ot_status ON overtime_records(status);

-- OT policy settings
ALTER TABLE system_settings ADD COLUMN ot_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE system_settings ADD COLUMN ot_daily_threshold_minutes INTEGER NOT NULL DEFAULT 540;
ALTER TABLE system_settings ADD COLUMN ot_weekly_threshold_minutes INTEGER NOT NULL DEFAULT 2880;
ALTER TABLE system_settings ADD COLUMN ot_multiplier REAL NOT NULL DEFAULT 2.0;
ALTER TABLE system_settings ADD COLUMN ot_holiday_multiplier REAL NOT NULL DEFAULT 3.0;
ALTER TABLE system_settings ADD COLUMN ot_requires_approval INTEGER NOT NULL DEFAULT 1;
ALTER TABLE system_settings ADD COLUMN ot_max_daily_minutes INTEGER NOT NULL DEFAULT 240;
