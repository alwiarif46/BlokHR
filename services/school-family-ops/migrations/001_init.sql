-- 001_init: Minimal family-ops tables (entitlement-gated stubs).

CREATE TABLE IF NOT EXISTS health_forms (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS health_forms_tenant_student_idx
  ON health_forms (tenant_id, student_ref);

CREATE TABLE IF NOT EXISTS meal_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS meal_orders_tenant_student_idx
  ON meal_orders (tenant_id, student_ref);

CREATE TABLE IF NOT EXISTS activity_regs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS activity_regs_tenant_student_idx
  ON activity_regs (tenant_id, student_ref);

CREATE TABLE IF NOT EXISTS pickup_authorizations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_ref TEXT NOT NULL,
  guardian_ref TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS pickup_authorizations_tenant_student_idx
  ON pickup_authorizations (tenant_id, student_ref);

CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_ref TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS community_posts_tenant_idx
  ON community_posts (tenant_id);

CREATE TABLE IF NOT EXISTS fundraising_pledges (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pledged',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS fundraising_pledges_tenant_student_idx
  ON fundraising_pledges (tenant_id, student_ref);
