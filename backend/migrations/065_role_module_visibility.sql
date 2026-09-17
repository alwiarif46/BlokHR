-- 065_role_module_visibility: per-tenant role→module visibility overrides + Roles & Access flag.
-- Missing row = visible (sparse defaults). Drift report for admins vs members.role='admin'.

CREATE TABLE IF NOT EXISTS role_module_visibility (
  tenant_id TEXT NOT NULL,
  role TEXT NOT NULL,
  module_key TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, role, module_key)
);

INSERT OR IGNORE INTO feature_flags (feature_key, label, description, category) VALUES
  ('role_access', 'Roles & Access', 'Per-role module visibility matrix (admin)', 'admin');

UPDATE feature_flags SET admin_only = 1 WHERE feature_key = 'role_access';

-- Drift report (read-only SELECT for ops; does not mutate).
-- members.role='admin' without admins row:
--   SELECT m.tenant_id, m.email FROM members m
--   WHERE lower(m.role) = 'admin' AND m.active = 1
--   AND NOT EXISTS (
--     SELECT 1 FROM admins a WHERE a.tenant_id = m.tenant_id AND lower(a.email) = lower(m.email)
--   );
-- admins without members.role='admin':
--   SELECT a.tenant_id, a.email FROM admins a
--   WHERE EXISTS (
--     SELECT 1 FROM members m WHERE m.tenant_id = a.tenant_id AND lower(m.email) = lower(a.email)
--     AND lower(COALESCE(m.role,'')) != 'admin'
--   );
