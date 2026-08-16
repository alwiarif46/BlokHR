-- Compliance calendar items + tenant status

CREATE TABLE IF NOT EXISTS compliance_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  authority TEXT NOT NULL,
  due_rule_json TEXT NOT NULL,
  guidance TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_items_scope_key
  ON compliance_items(coalesce(tenant_id, 'global'), key);

CREATE TABLE IF NOT EXISTS tenant_compliance_status (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  academic_session_ref TEXT NOT NULL,
  state TEXT NOT NULL,
  note TEXT,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_compliance_unique
  ON tenant_compliance_status(tenant_id, item_key, academic_session_ref);
