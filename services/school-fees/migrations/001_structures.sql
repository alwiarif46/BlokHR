-- Fee heads, structures, concessions (integer paise)

CREATE TABLE IF NOT EXISTS fee_heads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  taxable INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_heads_tenant_code
  ON fee_heads(tenant_id, code);

CREATE TABLE IF NOT EXISTS fee_structures (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  academic_session_ref TEXT NOT NULL,
  class_label TEXT NOT NULL,
  label TEXT NOT NULL,
  lines_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fee_structures_tenant_session
  ON fee_structures(tenant_id, academic_session_ref, class_label);

CREATE TABLE IF NOT EXISTS concessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  value INTEGER NOT NULL,
  applies_to_heads_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_concessions_tenant_code
  ON concessions(tenant_id, code);
