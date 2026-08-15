-- 004_leaves: Leave requests, PTO balances, and leave policies.

-- Leave policy definitions (admin-configured per leave type + member type)
CREATE TABLE IF NOT EXISTS leave_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  leave_type TEXT NOT NULL,              -- 'Casual', 'Sick', 'Earned', 'WFH', 'Comp-Off', 'Other'
  member_type_id TEXT NOT NULL DEFAULT 'fte' REFERENCES member_types(id),
  method TEXT NOT NULL DEFAULT 'flat',   -- 'flat', 'tenure_bucket', 'annual_grant', 'tenure_linear'
  config_json TEXT NOT NULL DEFAULT '{}', -- formula config (buckets, rates, limits)
  max_carry_forward REAL NOT NULL DEFAULT 0,
  max_accumulation REAL NOT NULL DEFAULT 30,
  encashable INTEGER NOT NULL DEFAULT 0,
  probation_months INTEGER NOT NULL DEFAULT 0,
  probation_accrual REAL NOT NULL DEFAULT 0,
  is_paid INTEGER NOT NULL DEFAULT 1,
  requires_approval INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(leave_type, member_type_id)
);

-- Default leave policies for FTE
INSERT OR IGNORE INTO leave_policies (leave_type, member_type_id, method, config_json, is_paid) VALUES
  ('Casual', 'fte', 'flat', '{"accrualPerMonth": 1.0}', 1),
  ('Sick', 'fte', 'flat', '{"accrualPerMonth": 0.5}', 1),
  ('Earned', 'fte', 'tenure_bucket', '{"buckets":[{"minMonths":0,"maxMonths":12,"accrualPerMonth":1.0},{"minMonths":12,"maxMonths":36,"accrualPerMonth":1.5},{"minMonths":36,"maxMonths":null,"accrualPerMonth":2.0}]}', 1),
  ('WFH', 'fte', 'flat', '{"accrualPerMonth": 0}', 1),
  ('Comp-Off', 'fte', 'flat', '{"accrualPerMonth": 0}', 1),
  ('Other', 'fte', 'flat', '{"accrualPerMonth": 0}', 0);

-- Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  person_name TEXT NOT NULL,
  person_email TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  policy_name TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'FullDay' CHECK(kind IN ('FullDay', 'FirstHalf', 'SecondHalf')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days_requested REAL NOT NULL DEFAULT 1,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved by Manager', 'Approved', 'Rejected', 'Cancelled')),
  paid_type TEXT NOT NULL DEFAULT '' CHECK(paid_type IN ('', 'paid', 'unpaid')),
  rejection_reason TEXT NOT NULL DEFAULT '',
  manager_approver_email TEXT NOT NULL DEFAULT '',
  hr_approver_email TEXT NOT NULL DEFAULT '',
  cancelled_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_leave_email ON leave_requests(person_email);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_dates ON leave_requests(start_date, end_date);

-- PTO balance tracking (one row per employee per leave type per year)
CREATE TABLE IF NOT EXISTS pto_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  year INTEGER NOT NULL,
  accrued REAL NOT NULL DEFAULT 0,
  used REAL NOT NULL DEFAULT 0,
  carry_forward REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(email, leave_type, year)
);
CREATE INDEX IF NOT EXISTS idx_pto_email ON pto_balances(email);
