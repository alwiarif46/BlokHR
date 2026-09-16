-- 001_init: Overtime service — tenant-scoped tables.
-- Extracted from monolith migrations 014_overtime.sql and 015_overtime_requests.sql
-- plus a per-tenant overtime_policy row and a compensation cache that avoids
-- cross-service DB joins into the monolith members table.

-- ═══════════════════════════════════════════════════════════════
--  overtime_records — one row per (tenant, email, date, ot_type).
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS overtime_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_ot_records_tenant_email ON overtime_records(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_ot_records_tenant_date ON overtime_records(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_ot_records_tenant_status ON overtime_records(tenant_id, status);

-- ═══════════════════════════════════════════════════════════════
--  overtime_requests — prior-approval workflow.
--  OT is only compensable when an approved request exists for the date.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS overtime_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
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
  UNIQUE(tenant_id, email, date)
);
CREATE INDEX IF NOT EXISTS idx_ot_requests_tenant_email ON overtime_requests(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_ot_requests_tenant_date ON overtime_requests(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_ot_requests_tenant_status ON overtime_requests(tenant_id, status);

-- ═══════════════════════════════════════════════════════════════
--  overtime_policy — one row per tenant.
--  Defaults align with Indian Factories Act §59 practice
--  (9h/day, 2× weekday, 3× holiday, 240 daily cap, 125 quarterly cap).
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS overtime_policy (
  tenant_id TEXT PRIMARY KEY,
  ot_enabled INTEGER NOT NULL DEFAULT 1,
  daily_threshold_minutes INTEGER NOT NULL DEFAULT 540,
  weekly_threshold_minutes INTEGER NOT NULL DEFAULT 2880,
  multiplier REAL NOT NULL DEFAULT 2.0,
  holiday_multiplier REAL NOT NULL DEFAULT 3.0,
  requires_approval INTEGER NOT NULL DEFAULT 1,
  requires_prior_approval INTEGER NOT NULL DEFAULT 1,
  max_daily_minutes INTEGER NOT NULL DEFAULT 240,
  max_quarterly_hours INTEGER NOT NULL DEFAULT 125,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════
--  member_compensation_cache — local read model of the fields
--  needed to compute OT pay. Populated by internal sync (or lazily
--  by the caller). Keeps this service free of cross-service DB joins.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS member_compensation_cache (
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  basic_salary REAL NOT NULL DEFAULT 0,
  da REAL NOT NULL DEFAULT 0,
  shift_start TEXT NOT NULL DEFAULT '09:00',
  shift_end TEXT NOT NULL DEFAULT '18:00',
  name TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_ot_comp_cache_tenant ON member_compensation_cache(tenant_id);
