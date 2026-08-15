-- Two-way guardian/school threads

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guardian_ref TEXT NOT NULL,
  student_ref TEXT NOT NULL,
  subject TEXT NOT NULL,
  state TEXT NOT NULL,
  assigned_to TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_threads_tenant_state
  ON threads(tenant_id, state, updated_at);

CREATE INDEX IF NOT EXISTS idx_threads_tenant_guardian
  ON threads(tenant_id, guardian_ref);

CREATE TABLE IF NOT EXISTS thread_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  body TEXT NOT NULL,
  lang_original TEXT,
  body_translated TEXT,
  translated_flag INTEGER NOT NULL DEFAULT 0,
  author TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (thread_id) REFERENCES threads(id)
);

CREATE INDEX IF NOT EXISTS idx_thread_messages_thread
  ON thread_messages(tenant_id, thread_id, at);
