-- 003_attendance: Daily attendance records and clock events.

-- One row per person per logical day.
CREATE TABLE IF NOT EXISTS attendance_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,                    -- logical date YYYY-MM-DD
  status TEXT NOT NULL DEFAULT 'off' CHECK(status IN ('off', 'in', 'break', 'out', 'absent', 'leave')),
  status_source TEXT NOT NULL DEFAULT '',  -- '', 'auto-cutoff', 'admin', 'geo', 'face'
  first_in TEXT,                         -- ISO timestamp of first clock-in
  last_out TEXT,                         -- ISO timestamp of last clock-out
  last_break_start TEXT,                 -- ISO timestamp for break timer
  last_back_time TEXT,                   -- ISO timestamp for work timer after break
  total_worked_minutes REAL NOT NULL DEFAULT 0,
  total_break_minutes REAL NOT NULL DEFAULT 0,
  is_late INTEGER NOT NULL DEFAULT 0,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  split_warning INTEGER NOT NULL DEFAULT 0,
  group_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(email, date)
);
CREATE INDEX IF NOT EXISTS idx_att_date ON attendance_daily(date);
CREATE INDEX IF NOT EXISTS idx_att_email ON attendance_daily(email);
CREATE INDEX IF NOT EXISTS idx_att_status ON attendance_daily(status);

-- Individual clock events (timeline). Every in/out/break/back is a row.
CREATE TABLE IF NOT EXISTS clock_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  date TEXT NOT NULL,                    -- logical date YYYY-MM-DD
  event_type TEXT NOT NULL CHECK(event_type IN ('in', 'out', 'break', 'back')),
  event_time TEXT NOT NULL,              -- ISO timestamp
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'auto-cutoff', 'admin', 'geo', 'face', 'bot'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_clock_email_date ON clock_events(email, date);
CREATE INDEX IF NOT EXISTS idx_clock_date ON clock_events(date);

-- Monthly late counter (denormalized for fast access)
CREATE TABLE IF NOT EXISTS monthly_late_counts (
  email TEXT NOT NULL,
  year_month TEXT NOT NULL,              -- YYYY-MM
  late_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(email, year_month)
);
