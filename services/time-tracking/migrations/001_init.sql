-- 001_init: time-tracking (multi-tenant).
-- Clients, projects, and time entries with tenant_id on every row.
-- Seeds an internal client and default non-billable projects for tenant 'default'.

CREATE TABLE IF NOT EXISTS clients (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  billing_rate_hourly REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  contact_name TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_clients_tenant_name ON clients(tenant_id, name);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  billable INTEGER NOT NULL DEFAULT 1,
  billing_rate_hourly REAL,
  budget_hours REAL,
  budget_amount REAL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','on_hold','cancelled')),
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_projects_tenant_client ON projects(tenant_id, client_id);

CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  hours REAL NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  billable INTEGER NOT NULL DEFAULT 1,
  billing_rate_hourly REAL,
  approved INTEGER NOT NULL DEFAULT 0,
  approved_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_time_tenant_email ON time_entries(tenant_id, email);

CREATE INDEX IF NOT EXISTS idx_time_tenant_date ON time_entries(tenant_id, date);

CREATE INDEX IF NOT EXISTS idx_time_tenant_project ON time_entries(tenant_id, project_id);

CREATE INDEX IF NOT EXISTS idx_time_tenant_email_date ON time_entries(tenant_id, email, date);

INSERT OR IGNORE INTO clients (id, tenant_id, name, code, active) VALUES ('internal', 'default', 'Internal', 'INT', 1);

INSERT OR IGNORE INTO projects (id, tenant_id, client_id, name, code, billable) VALUES ('admin-overhead', 'default', 'internal', 'Admin & Overhead', 'ADM', 0);

INSERT OR IGNORE INTO projects (id, tenant_id, client_id, name, code, billable) VALUES ('training', 'default', 'internal', 'Training & Development', 'TRN', 0);

INSERT OR IGNORE INTO projects (id, tenant_id, client_id, name, code, billable) VALUES ('meetings-internal', 'default', 'internal', 'Internal Meetings', 'MTG', 0);
