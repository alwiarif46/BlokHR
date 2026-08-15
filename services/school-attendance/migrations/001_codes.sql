-- Attendance reason codes

CREATE TABLE IF NOT EXISTS reason_codes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  bucket TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reason_codes_tenant ON reason_codes(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reason_codes_code ON reason_codes(tenant_id, code);
