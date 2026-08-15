-- 023_event_bus: Redis config on branding (setup wizard) + outbound webhook subscriptions.

-- Redis/Valkey connection URL (blank = in-memory mode)
ALTER TABLE branding ADD COLUMN redis_url TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN event_retention_days INTEGER NOT NULL DEFAULT 90;

-- Outbound webhook subscriptions (customers register URLs to receive events)
CREATE TABLE IF NOT EXISTS outbound_webhook_subscriptions (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  secret TEXT NOT NULL DEFAULT '',
  event_types TEXT NOT NULL DEFAULT '*',
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Outbound webhook delivery log
CREATE TABLE IF NOT EXISTS outbound_webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id TEXT NOT NULL REFERENCES outbound_webhook_subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'delivered', 'failed')),
  http_status INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_owd_sub ON outbound_webhook_deliveries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_owd_status ON outbound_webhook_deliveries(status);
