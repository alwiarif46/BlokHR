-- Entitlements service schema (service-owned)
CREATE TABLE IF NOT EXISTS entitlements (
  tenant_id TEXT PRIMARY KEY,
  channel TEXT NOT NULL DEFAULT 'cloud',
  plan TEXT NOT NULL DEFAULT 'trial',
  status TEXT NOT NULL DEFAULT 'trialing',
  seat_limit INTEGER NOT NULL DEFAULT 25,
  modules_json TEXT NOT NULL DEFAULT '[]',
  trial_ends_at TEXT,
  renews_at TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  source TEXT NOT NULL DEFAULT 'manual',
  license_payload_json TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entitlement_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_entitlement_events_tenant ON entitlement_events(tenant_id);
