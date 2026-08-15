-- Guardian notification channels + tenant engagement settings

CREATE TABLE IF NOT EXISTS guardian_channels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guardian_ref TEXT NOT NULL,
  channel TEXT NOT NULL,
  address TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guardian_channels_guardian
  ON guardian_channels(tenant_id, guardian_ref, priority);

CREATE TABLE IF NOT EXISTS engagement_settings (
  tenant_id TEXT PRIMARY KEY,
  daily_cap_per_student INTEGER NOT NULL DEFAULT 3,
  digest_hour INTEGER NOT NULL DEFAULT 17,
  digest_frequency TEXT NOT NULL DEFAULT 'daily',
  quiet_start INTEGER NOT NULL DEFAULT 21,
  quiet_end INTEGER NOT NULL DEFAULT 7,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
