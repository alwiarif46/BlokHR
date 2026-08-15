-- Message templates + outbound log

CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  key TEXT NOT NULL,
  lang TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL,
  reviewed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_templates_scope
  ON message_templates(coalesce(tenant_id, 'global'), key, lang);

CREATE TABLE IF NOT EXISTS outbound_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_ref TEXT,
  guardian_ref TEXT NOT NULL,
  template_key TEXT NOT NULL,
  lang TEXT NOT NULL,
  channel TEXT NOT NULL,
  rendered_body TEXT NOT NULL,
  status TEXT NOT NULL,
  suppress_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbound_messages_tenant_student
  ON outbound_messages(tenant_id, student_ref, created_at);

CREATE INDEX IF NOT EXISTS idx_outbound_messages_status
  ON outbound_messages(tenant_id, status, created_at);
