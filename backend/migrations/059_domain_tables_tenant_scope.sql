-- 059_domain_tables_tenant_scope: tenant_id for attendance-adjacent domain tables.
-- Attribution is N-tenant generic: prefer active members, then admins;
-- tie-break prefers non-default via ORDER BY (tenant_id = 'default') ASC, tenant_id ASC.
-- Never hardcodes named tenant IDs.

-- Helper attribution pattern used below:
-- COALESCE(
--   (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(E) AND COALESCE(m.active,1)=1
--      ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
--   (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(E)
--      ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
--   'default'
-- )

-- ── groups ─────────────────────────────────────────────────────────────────────
ALTER TABLE groups ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

UPDATE groups SET tenant_id = COALESCE(
  (SELECT m.tenant_id FROM members m
   WHERE m.group_id = groups.id AND COALESCE(m.active, 1) = 1
   ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC
   LIMIT 1),
  'default'
);

CREATE INDEX IF NOT EXISTS idx_groups_tenant ON groups(tenant_id);

-- ── role_assignments ───────────────────────────────────────────────────────────
ALTER TABLE role_assignments ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

UPDATE role_assignments SET tenant_id = COALESCE(
  (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(role_assignments.assignee_email) AND COALESCE(m.active, 1) = 1
   ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
  (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(role_assignments.assignee_email)
   ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
  'default'
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant ON role_assignments(tenant_id);

-- ── regularizations ────────────────────────────────────────────────────────────
ALTER TABLE regularizations ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

UPDATE regularizations SET tenant_id = COALESCE(
  (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(regularizations.email) AND COALESCE(m.active, 1) = 1
   ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
  (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(regularizations.email)
   ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
  'default'
);

CREATE INDEX IF NOT EXISTS idx_reg_tenant ON regularizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reg_tenant_status ON regularizations(tenant_id, status);

-- ── overtime_records (UNIQUE must include tenant_id) ───────────────────────────
CREATE TABLE IF NOT EXISTS overtime_records_mt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
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
  UNIQUE(tenant_id, email, date, ot_type)
);

INSERT OR IGNORE INTO overtime_records_mt (
  tenant_id, email, date, shift_start, shift_end, actual_worked_minutes, standard_minutes,
  ot_minutes, ot_type, hourly_rate, multiplier, ot_pay, source, status, approved_by,
  rejection_reason, created_at, updated_at
)
SELECT
  COALESCE(
    (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(ot.email) AND COALESCE(m.active, 1) = 1
     ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
    (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(ot.email)
     ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
    'default'
  ),
  ot.email, ot.date, ot.shift_start, ot.shift_end, ot.actual_worked_minutes, ot.standard_minutes,
  ot.ot_minutes, ot.ot_type, ot.hourly_rate, ot.multiplier, ot.ot_pay, ot.source, ot.status,
  ot.approved_by, ot.rejection_reason, ot.created_at, ot.updated_at
FROM overtime_records ot;

DROP TABLE overtime_records;
ALTER TABLE overtime_records_mt RENAME TO overtime_records;

CREATE INDEX IF NOT EXISTS idx_ot_tenant_email ON overtime_records(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_ot_tenant_date ON overtime_records(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_ot_tenant_status ON overtime_records(tenant_id, status);

-- ── timesheets (UNIQUE must include tenant_id) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS timesheets_mt (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  period_type TEXT NOT NULL CHECK(period_type IN ('weekly', 'monthly')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
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
  PRIMARY KEY (tenant_id, id),
  UNIQUE(tenant_id, email, period_type, start_date)
);

INSERT OR IGNORE INTO timesheets_mt (
  tenant_id, id, email, name, period_type, start_date, end_date,
  total_worked_minutes, total_break_minutes, total_present_days, total_absent_days,
  total_leave_days, total_holiday_days, total_late_days, total_ot_minutes, total_ot_pay,
  total_billable_hours, total_non_billable_hours, status, submitted_at, approved_by,
  approved_at, rejected_by, rejected_at, rejection_reason, created_at, updated_at
)
SELECT
  COALESCE(
    (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(t.email) AND COALESCE(m.active, 1) = 1
     ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
    (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(t.email)
     ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
    'default'
  ),
  t.id, t.email, t.name, t.period_type, t.start_date, t.end_date,
  t.total_worked_minutes, t.total_break_minutes, t.total_present_days, t.total_absent_days,
  t.total_leave_days, t.total_holiday_days, t.total_late_days, t.total_ot_minutes, t.total_ot_pay,
  t.total_billable_hours, t.total_non_billable_hours, t.status, t.submitted_at, t.approved_by,
  t.approved_at, t.rejected_by, t.rejected_at, t.rejection_reason, t.created_at, t.updated_at
FROM timesheets t;

-- Keep child tables; drop parent carefully — child FKs reference timesheets(id) by id alone.
-- Rebuild timesheet_entries / adjustments to drop FK if needed: SQLite ignores FK by default often.
DROP TABLE timesheets;
ALTER TABLE timesheets_mt RENAME TO timesheets;

CREATE INDEX IF NOT EXISTS idx_ts_tenant_email ON timesheets(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_ts_tenant_status ON timesheets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ts_tenant_dates ON timesheets(tenant_id, start_date, end_date);

-- ── time_entries ───────────────────────────────────────────────────────────────
ALTER TABLE time_entries ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

UPDATE time_entries SET tenant_id = COALESCE(
  (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(time_entries.email) AND COALESCE(m.active, 1) = 1
   ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
  (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(time_entries.email)
   ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
  'default'
);

CREATE INDEX IF NOT EXISTS idx_time_tenant_email ON time_entries(tenant_id, email);

-- ── holidays (UNIQUE must include tenant_id) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS holidays_mt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'mandatory' CHECK(type IN ('mandatory', 'optional', 'restricted')),
  year INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, date, name)
);

INSERT OR IGNORE INTO holidays_mt (tenant_id, date, name, type, year, active, created_at, updated_at)
SELECT 'default', date, name, type, year, active, created_at, updated_at FROM holidays;

-- Copy default holidays into every known branding tenant (N-tenant seed)
INSERT OR IGNORE INTO holidays_mt (tenant_id, date, name, type, year, active, created_at, updated_at)
SELECT b.tenant_id, h.date, h.name, h.type, h.year, h.active, h.created_at, h.updated_at
FROM holidays h
CROSS JOIN branding b
WHERE b.tenant_id IS NOT NULL AND TRIM(b.tenant_id) != '' AND b.tenant_id != 'default';

-- Remap employee_holiday_selections.holiday_id via old→new map is hard after rebuild.
-- Preserve selections by joining on date/name under default then re-attribute.
CREATE TABLE IF NOT EXISTS employee_holiday_selections_mt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  email TEXT NOT NULL,
  holiday_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, email, holiday_id)
);

INSERT OR IGNORE INTO employee_holiday_selections_mt (tenant_id, email, holiday_id, year, created_at)
SELECT
  COALESCE(
    (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(ehs.email) AND COALESCE(m.active, 1) = 1
     ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
    (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(ehs.email)
     ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
    'default'
  ),
  ehs.email,
  COALESCE(
    (SELECT hm.id FROM holidays_mt hm
     JOIN holidays h ON h.id = ehs.holiday_id
     WHERE hm.tenant_id = COALESCE(
       (SELECT m.tenant_id FROM members m WHERE lower(m.email) = lower(ehs.email) AND COALESCE(m.active, 1) = 1
        ORDER BY (m.tenant_id = 'default') ASC, m.tenant_id ASC LIMIT 1),
       (SELECT a.tenant_id FROM admins a WHERE lower(a.email) = lower(ehs.email)
        ORDER BY (a.tenant_id = 'default') ASC, a.tenant_id ASC LIMIT 1),
       'default'
     ) AND hm.date = h.date AND hm.name = h.name
     LIMIT 1),
    ehs.holiday_id
  ),
  ehs.year,
  ehs.created_at
FROM employee_holiday_selections ehs;

DROP TABLE employee_holiday_selections;
DROP TABLE holidays;
ALTER TABLE holidays_mt RENAME TO holidays;
ALTER TABLE employee_holiday_selections_mt RENAME TO employee_holiday_selections;

CREATE INDEX IF NOT EXISTS idx_holidays_tenant_date ON holidays(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_holidays_tenant_year ON holidays(tenant_id, year);
CREATE INDEX IF NOT EXISTS idx_ehs_tenant_email ON employee_holiday_selections(tenant_id, email);
