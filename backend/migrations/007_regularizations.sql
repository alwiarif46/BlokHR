-- 007_regularizations: Attendance correction requests with two-tier approval.

CREATE TABLE IF NOT EXISTS regularizations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  correction_type TEXT NOT NULL DEFAULT 'both' CHECK(correction_type IN ('clock-in', 'clock-out', 'both')),
  in_time TEXT NOT NULL DEFAULT '',
  out_time TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'manager_approved', 'approved', 'rejected')),
  manager_approver_email TEXT NOT NULL DEFAULT '',
  hr_approver_email TEXT NOT NULL DEFAULT '',
  rejection_comments TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reg_email ON regularizations(email);
CREATE INDEX IF NOT EXISTS idx_reg_status ON regularizations(status);
CREATE INDEX IF NOT EXISTS idx_reg_date ON regularizations(date);
