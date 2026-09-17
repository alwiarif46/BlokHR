-- 058_fact_tables_tenant_scope: add tenant_id to operational fact tables.
-- This closes cross-tenant mixing where earlier tables were keyed by email/date only.

-- ── attendance_daily ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_daily_mt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'off' CHECK(status IN ('off', 'in', 'break', 'out', 'absent', 'leave')),
  status_source TEXT NOT NULL DEFAULT '',
  first_in TEXT,
  last_out TEXT,
  last_break_start TEXT,
  last_back_time TEXT,
  total_worked_minutes REAL NOT NULL DEFAULT 0,
  total_break_minutes REAL NOT NULL DEFAULT 0,
  is_late INTEGER NOT NULL DEFAULT 0,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  split_warning INTEGER NOT NULL DEFAULT 0,
  group_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, email, date)
);

INSERT OR IGNORE INTO attendance_daily_mt (
  tenant_id, email, name, date, status, status_source, first_in, last_out,
  last_break_start, last_back_time, total_worked_minutes, total_break_minutes,
  is_late, late_minutes, split_warning, group_id, created_at, updated_at
)
SELECT
  COALESCE(
    (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(ad.email) ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
    (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(ad.email) ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
    'default'
  ) AS tenant_id,
  ad.email, ad.name, ad.date, ad.status, ad.status_source, ad.first_in, ad.last_out,
  ad.last_break_start, ad.last_back_time, ad.total_worked_minutes, ad.total_break_minutes,
  ad.is_late, ad.late_minutes, ad.split_warning, ad.group_id, ad.created_at, ad.updated_at
FROM attendance_daily ad;

DROP TABLE attendance_daily;
ALTER TABLE attendance_daily_mt RENAME TO attendance_daily;

CREATE INDEX IF NOT EXISTS idx_att_tenant_date ON attendance_daily(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_att_tenant_email ON attendance_daily(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_att_tenant_status ON attendance_daily(tenant_id, status);

-- ── clock_events ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clock_events_mt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  email TEXT NOT NULL,
  date TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('in', 'out', 'break', 'back')),
  event_time TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO clock_events_mt (tenant_id, email, date, event_type, event_time, source, created_at)
SELECT
  COALESCE(
    (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(ce.email) ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
    (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(ce.email) ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
    'default'
  ) AS tenant_id,
  ce.email, ce.date, ce.event_type, ce.event_time, ce.source, ce.created_at
FROM clock_events ce;

DROP TABLE clock_events;
ALTER TABLE clock_events_mt RENAME TO clock_events;

CREATE INDEX IF NOT EXISTS idx_clock_tenant_email_date ON clock_events(tenant_id, email, date);
CREATE INDEX IF NOT EXISTS idx_clock_tenant_date ON clock_events(tenant_id, date);

-- ── monthly_late_counts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_late_counts_mt (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  email TEXT NOT NULL,
  year_month TEXT NOT NULL,
  late_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, email, year_month)
);

INSERT OR IGNORE INTO monthly_late_counts_mt (tenant_id, email, year_month, late_count)
SELECT
  COALESCE(
    (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(ml.email) ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
    (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(ml.email) ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
    'default'
  ) AS tenant_id,
  ml.email, ml.year_month, ml.late_count
FROM monthly_late_counts ml;

DROP TABLE monthly_late_counts;
ALTER TABLE monthly_late_counts_mt RENAME TO monthly_late_counts;

-- ── leave_requests ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests_mt (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  id TEXT NOT NULL,
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
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, id)
);

INSERT OR IGNORE INTO leave_requests_mt (
  tenant_id, id, person_name, person_email, leave_type, policy_name, kind, start_date, end_date,
  days_requested, reason, status, paid_type, rejection_reason, manager_approver_email,
  hr_approver_email, cancelled_by, created_at, updated_at
)
SELECT
  COALESCE(
    (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(lr.person_email) ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
    (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(lr.person_email) ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
    'default'
  ) AS tenant_id,
  lr.id, lr.person_name, lr.person_email, lr.leave_type, lr.policy_name, lr.kind, lr.start_date, lr.end_date,
  lr.days_requested, lr.reason, lr.status, lr.paid_type, lr.rejection_reason, lr.manager_approver_email,
  lr.hr_approver_email, lr.cancelled_by, lr.created_at, lr.updated_at
FROM leave_requests lr;

DROP TABLE leave_requests;
ALTER TABLE leave_requests_mt RENAME TO leave_requests;

CREATE INDEX IF NOT EXISTS idx_leave_tenant_email ON leave_requests(tenant_id, person_email);
CREATE INDEX IF NOT EXISTS idx_leave_tenant_status ON leave_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_tenant_dates ON leave_requests(tenant_id, start_date, end_date);

-- ── pto_balances ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pto_balances_mt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  email TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  year INTEGER NOT NULL,
  accrued REAL NOT NULL DEFAULT 0,
  used REAL NOT NULL DEFAULT 0,
  carry_forward REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, email, leave_type, year)
);

INSERT OR IGNORE INTO pto_balances_mt (
  tenant_id, email, leave_type, year, accrued, used, carry_forward, updated_at
)
SELECT
  COALESCE(
    (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(pb.email) ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
    (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(pb.email) ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
    'default'
  ) AS tenant_id,
  pb.email, pb.leave_type, pb.year, pb.accrued, pb.used, pb.carry_forward, pb.updated_at
FROM pto_balances pb;

DROP TABLE pto_balances;
ALTER TABLE pto_balances_mt RENAME TO pto_balances;

CREATE INDEX IF NOT EXISTS idx_pto_tenant_email ON pto_balances(tenant_id, email);
