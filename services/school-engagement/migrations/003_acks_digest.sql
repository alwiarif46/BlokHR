-- Message acks + digest run idempotency

CREATE TABLE IF NOT EXISTS message_acks (
  message_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  acked_at TEXT NOT NULL DEFAULT (datetime('now')),
  acked_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_message_acks_tenant
  ON message_acks(tenant_id, message_id);

CREATE TABLE IF NOT EXISTS digest_runs (
  tenant_id TEXT NOT NULL,
  guardian_ref TEXT NOT NULL,
  run_date TEXT NOT NULL,
  digest_message_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, guardian_ref, run_date)
);
