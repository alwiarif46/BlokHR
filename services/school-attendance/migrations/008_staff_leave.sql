-- Thin native staff leave (types, balances, requests) — school-attendance only

CREATE TABLE IF NOT EXISTS leave_types (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  annual_quota REAL NOT NULL,
  carry_forward INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_types_tenant_code
  ON leave_types(tenant_id, code);

CREATE TABLE IF NOT EXISTS leave_balances (
  tenant_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  leave_type_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  opening REAL NOT NULL,
  used REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, member_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  leave_type_id TEXT NOT NULL,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  is_half_day INTEGER NOT NULL DEFAULT 0,
  days REAL NOT NULL,
  reason TEXT,
  state TEXT NOT NULL DEFAULT 'pending',
  decided_by TEXT,
  decided_at TEXT,
  decision_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_member
  ON leave_requests(tenant_id, member_id, state);

CREATE INDEX IF NOT EXISTS idx_leave_requests_dates
  ON leave_requests(tenant_id, member_id, from_date, to_date);
