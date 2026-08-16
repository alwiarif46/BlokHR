-- Migration 050: Timesheet adjustments
-- Timesheets are derived from attendance/leave/OT/time entries. An admin may
-- override a single day's worked minutes, but the original derived value and
-- the reason are always retained so the sheet stays auditable.

-- ── Per-day override on timesheet_entries (adjusted_minutes NULL = not adjusted) ──
ALTER TABLE timesheet_entries ADD COLUMN adjusted_minutes REAL DEFAULT NULL;
ALTER TABLE timesheet_entries ADD COLUMN adjustment_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE timesheet_entries ADD COLUMN adjusted_by TEXT NOT NULL DEFAULT '';
ALTER TABLE timesheet_entries ADD COLUMN adjusted_at TEXT DEFAULT NULL;

-- ── Adjustment trail ──
CREATE TABLE IF NOT EXISTS timesheet_adjustments (
  id TEXT PRIMARY KEY,
  timesheet_id TEXT NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('adjusted', 'reverted')),
  previous_minutes REAL NOT NULL DEFAULT 0,
  new_minutes REAL NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  actor_email TEXT NOT NULL DEFAULT '',
  acted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ts_adjustments_timesheet ON timesheet_adjustments(timesheet_id);
CREATE INDEX IF NOT EXISTS idx_ts_adjustments_date ON timesheet_adjustments(date);

-- ── Feature flag ──
INSERT OR IGNORE INTO feature_flags (feature_key, label, description, category, enabled)
VALUES (
  'timesheets',
  'Timesheets',
  'Weekly and monthly timesheets derived from attendance, leave, overtime, and logged time',
  'operations',
  1
);
