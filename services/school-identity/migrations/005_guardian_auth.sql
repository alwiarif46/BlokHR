-- Guardian credentials and opaque sessions (separate auth principal — never members)

CREATE TABLE IF NOT EXISTS guardian_credentials (
  guardian_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT,
  otp_hash TEXT,
  otp_expires_at TEXT,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guardian_credentials_phone
  ON guardian_credentials(phone);

CREATE INDEX IF NOT EXISTS idx_guardian_credentials_tenant
  ON guardian_credentials(tenant_id, guardian_id);

CREATE TABLE IF NOT EXISTS guardian_sessions (
  token_hash TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guardian_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_guardian_sessions_guardian
  ON guardian_sessions(tenant_id, guardian_id);
