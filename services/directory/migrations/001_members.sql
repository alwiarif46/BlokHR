-- Directory service owns the employee roster (one row per person per tenant).

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  group_id TEXT,
  designation TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  individual_shift_start TEXT,
  individual_shift_end TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_members_tenant_active ON members (tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_members_tenant_email ON members (tenant_id, email);
