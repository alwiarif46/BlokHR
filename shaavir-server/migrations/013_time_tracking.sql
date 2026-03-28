-- 013_time_tracking: Clients, projects, and time entries for billable/non-billable logging.

-- Clients (external or internal)
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  billing_rate_hourly REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  contact_name TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Internal client for non-billable work
INSERT OR IGNORE INTO clients (id, name, code, active) VALUES ('internal', 'Internal', 'INT', 1);

-- Projects (belong to a client)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  billable INTEGER NOT NULL DEFAULT 1,
  billing_rate_hourly REAL,
  budget_hours REAL,
  budget_amount REAL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'on_hold', 'cancelled')),
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);

-- Default internal projects
INSERT OR IGNORE INTO projects (id, client_id, name, code, billable) VALUES
  ('admin-overhead', 'internal', 'Admin & Overhead', 'ADM', 0),
  ('training', 'internal', 'Training & Development', 'TRN', 0),
  ('meetings-internal', 'internal', 'Internal Meetings', 'MTG', 0);

-- Time entries (one per person per project per day, can have multiple)
CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
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
CREATE INDEX IF NOT EXISTS idx_time_email ON time_entries(email);
CREATE INDEX IF NOT EXISTS idx_time_date ON time_entries(date);
CREATE INDEX IF NOT EXISTS idx_time_project ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_email_date ON time_entries(email, date);
