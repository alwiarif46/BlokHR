-- 008_bd_meetings: BD meeting qualification/approval workflow.
-- ONLY for Business Development department members.
-- Flow: pending → qualified → approved (rejection at any open stage).

CREATE TABLE IF NOT EXISTS bd_meetings (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  time TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'qualified', 'notified', 'approved', 'rejected')),
  qualifier_email TEXT NOT NULL DEFAULT '',
  approver_email TEXT NOT NULL DEFAULT '',
  rejection_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bd_meetings_email ON bd_meetings(email);
CREATE INDEX IF NOT EXISTS idx_bd_meetings_status ON bd_meetings(status);
CREATE INDEX IF NOT EXISTS idx_bd_meetings_date ON bd_meetings(date);
