-- 017_timesheets: Automated timesheets — frozen snapshots of attendance + leaves + OT + time entries.

-- One row per employee per period (weekly or monthly).
CREATE TABLE IF NOT EXISTS timesheets (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  period_type TEXT NOT NULL CHECK(period_type IN ('weekly', 'monthly')),
  start_date TEXT NOT NULL,              -- YYYY-MM-DD (inclusive)
  end_date TEXT NOT NULL,                -- YYYY-MM-DD (inclusive)
  total_worked_minutes REAL NOT NULL DEFAULT 0,
  total_break_minutes REAL NOT NULL DEFAULT 0,
  total_present_days INTEGER NOT NULL DEFAULT 0,
  total_absent_days INTEGER NOT NULL DEFAULT 0,
  total_leave_days REAL NOT NULL DEFAULT 0,
  total_holiday_days INTEGER NOT NULL DEFAULT 0,
  total_late_days INTEGER NOT NULL DEFAULT 0,
  total_ot_minutes REAL NOT NULL DEFAULT 0,
  total_ot_pay REAL NOT NULL DEFAULT 0,
  total_billable_hours REAL NOT NULL DEFAULT 0,
  total_non_billable_hours REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at TEXT,
  approved_by TEXT NOT NULL DEFAULT '',
  approved_at TEXT,
  rejected_by TEXT NOT NULL DEFAULT '',
  rejected_at TEXT,
  rejection_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(email, period_type, start_date)
);
CREATE INDEX IF NOT EXISTS idx_ts_email ON timesheets(email);
CREATE INDEX IF NOT EXISTS idx_ts_dates ON timesheets(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_ts_status ON timesheets(status);
CREATE INDEX IF NOT EXISTS idx_ts_period ON timesheets(period_type);

-- Daily breakdown rows linked to a parent timesheet.
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timesheet_id TEXT NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  date TEXT NOT NULL,                    -- YYYY-MM-DD
  day_type TEXT NOT NULL DEFAULT 'workday' CHECK(day_type IN ('workday', 'weekend', 'holiday', 'leave')),
  attendance_status TEXT NOT NULL DEFAULT '' CHECK(attendance_status IN ('', 'in', 'out', 'absent', 'leave', 'off', 'break')),
  worked_minutes REAL NOT NULL DEFAULT 0,
  break_minutes REAL NOT NULL DEFAULT 0,
  is_late INTEGER NOT NULL DEFAULT 0,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  ot_minutes REAL NOT NULL DEFAULT 0,
  ot_pay REAL NOT NULL DEFAULT 0,
  leave_type TEXT NOT NULL DEFAULT '',
  leave_days REAL NOT NULL DEFAULT 0,
  billable_hours REAL NOT NULL DEFAULT 0,
  non_billable_hours REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(timesheet_id, date)
);
CREATE INDEX IF NOT EXISTS idx_tse_timesheet ON timesheet_entries(timesheet_id);
CREATE INDEX IF NOT EXISTS idx_tse_date ON timesheet_entries(date);
