-- 002_settings: Members, groups, shifts, roles, and system settings.
-- Foundation tables that every business module depends on.

-- Department / team groups
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  shift_start TEXT,            -- HH:MM, group-level shift start
  shift_end TEXT,              -- HH:MM, group-level shift end
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Designations (job titles) — admin-configured
CREATE TABLE IF NOT EXISTS designations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Member types (FTE, hourly, intern, contractor, etc.) — admin-configured
CREATE TABLE IF NOT EXISTS member_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO member_types (id, name, description) VALUES
  ('fte', 'Full-Time Employee', 'Standard full-time employee'),
  ('hourly', 'Hourly', 'Paid by the hour'),
  ('project', 'Project-Based', 'Engaged on a per-project basis'),
  ('intern', 'Intern', 'Internship position'),
  ('contractor', 'Contractor', 'External contractor');

-- Employee members
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  member_type_id TEXT NOT NULL DEFAULT 'fte' REFERENCES member_types(id),
  role TEXT NOT NULL DEFAULT 'employee',  -- 'employee', 'intern', etc. for display badges
  designation TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  photo TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  emergency_contact TEXT NOT NULL DEFAULT '',
  joining_date TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',       -- physical office or remote
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',

  -- Individual shift override (takes priority over group shift)
  individual_shift_start TEXT,
  individual_shift_end TEXT,

  -- Google / Teams identity
  google_email TEXT NOT NULL DEFAULT '',
  google_is_shaavir INTEGER NOT NULL DEFAULT 0,
  teams_user_id TEXT NOT NULL DEFAULT '',
  ms_user_id TEXT NOT NULL DEFAULT '',

  -- Financial & identity (PII — redacted in logs)
  pan_number TEXT NOT NULL DEFAULT '',
  aadhaar_number TEXT NOT NULL DEFAULT '',
  uan_number TEXT NOT NULL DEFAULT '',
  ac_parentage TEXT NOT NULL DEFAULT '',
  bank_account_number TEXT NOT NULL DEFAULT '',
  bank_ifsc TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',

  -- Profile certification
  certified_at TEXT,
  certified_by TEXT NOT NULL DEFAULT '',
  profile_unlocked INTEGER NOT NULL DEFAULT 0,

  -- Notification preferences (JSON)
  notification_config_json TEXT NOT NULL DEFAULT '{}',

  -- Webhook
  personal_webhook_url TEXT NOT NULL DEFAULT '',

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_id);
CREATE INDEX IF NOT EXISTS idx_members_active ON members(active);

-- Admin list
CREATE TABLE IF NOT EXISTS admins (
  email TEXT PRIMARY KEY
);

-- Role assignments (manager / HR at global, group, or member level)
CREATE TABLE IF NOT EXISTS role_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignee_email TEXT NOT NULL,         -- who has the role
  role_type TEXT NOT NULL CHECK(role_type IN ('manager', 'hr')),
  scope_type TEXT NOT NULL CHECK(scope_type IN ('global', 'group', 'member')),
  scope_value TEXT NOT NULL DEFAULT '', -- group id or member email, empty for global
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_roles_assignee ON role_assignments(assignee_email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_unique ON role_assignments(assignee_email, role_type, scope_type, scope_value);

-- Late rules configuration
CREATE TABLE IF NOT EXISTS late_rules (
  id INTEGER PRIMARY KEY CHECK(id = 1),  -- singleton row
  grace_minutes INTEGER NOT NULL DEFAULT 15,
  lates_to_deduction INTEGER NOT NULL DEFAULT 4,
  deduction_days REAL NOT NULL DEFAULT 0.5,
  tier1_count INTEGER NOT NULL DEFAULT 2,
  tier2_count INTEGER NOT NULL DEFAULT 3,
  tier3_count INTEGER NOT NULL DEFAULT 4,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO late_rules (id) VALUES (1);

-- System settings (singleton KV for structured config)
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  logical_day_change_time TEXT NOT NULL DEFAULT '06:00',
  employee_of_month_name TEXT NOT NULL DEFAULT '',
  employee_of_month_email TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO system_settings (id) VALUES (1);
