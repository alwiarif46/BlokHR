-- Topic delivery (period-instance completion) — opaque period_instance_id from timetable

CREATE TABLE IF NOT EXISTS topic_delivery (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  period_instance_id TEXT NOT NULL,
  section_ref TEXT NOT NULL,
  date TEXT NOT NULL,
  teacher_member_id TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_delivery_unique
  ON topic_delivery(tenant_id, topic_id, period_instance_id);

CREATE INDEX IF NOT EXISTS idx_topic_delivery_section
  ON topic_delivery(tenant_id, section_ref, topic_id);
