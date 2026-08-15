-- Generated and manual period instances

CREATE TABLE IF NOT EXISTS period_instances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  date TEXT NOT NULL,
  period_index INTEGER NOT NULL,
  allocation_id TEXT NOT NULL,
  status TEXT NOT NULL,
  lost_reason TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_period_instances_unique
  ON period_instances(tenant_id, section_id, date, period_index);
CREATE INDEX IF NOT EXISTS idx_period_instances_section_date
  ON period_instances(tenant_id, section_id, date);
CREATE INDEX IF NOT EXISTS idx_period_instances_status
  ON period_instances(tenant_id, status);
