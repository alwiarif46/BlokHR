-- 015_overtime_requests: Prior-approval workflow for overtime.
-- OT is only compensable when an approved request exists for the date.

CREATE TABLE IF NOT EXISTS overtime_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  planned_hours REAL NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by TEXT NOT NULL DEFAULT '',
  rejection_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(email, date)
);
CREATE INDEX IF NOT EXISTS idx_otr_email ON overtime_requests(email);
CREATE INDEX IF NOT EXISTS idx_otr_date ON overtime_requests(date);
CREATE INDEX IF NOT EXISTS idx_otr_status ON overtime_requests(status);

-- Add prior-approval toggle (separate from post-facto approval)
ALTER TABLE system_settings ADD COLUMN ot_requires_prior_approval INTEGER NOT NULL DEFAULT 1;
