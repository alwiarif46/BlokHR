CREATE TABLE IF NOT EXISTS library_settings (
  tenant_id TEXT PRIMARY KEY,
  loan_days INTEGER NOT NULL DEFAULT 14,
  renew_limit INTEGER NOT NULL DEFAULT 1,
  max_open_loans INTEGER NOT NULL DEFAULT 3,
  hold_days INTEGER NOT NULL DEFAULT 3,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  copy_id TEXT NOT NULL,
  student_ref TEXT NOT NULL,
  issued_on TEXT NOT NULL,
  due_on TEXT NOT NULL,
  returned_on TEXT,
  renewals INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  issued_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (copy_id) REFERENCES copies(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS loans_open_copy_uq
  ON loans (tenant_id, copy_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS loans_tenant_student_idx
  ON loans (tenant_id, student_ref);

CREATE INDEX IF NOT EXISTS loans_tenant_status_idx
  ON loans (tenant_id, status);

CREATE TABLE IF NOT EXISTS holds (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title_id TEXT NOT NULL,
  student_ref TEXT NOT NULL,
  position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  ready_copy_id TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (title_id) REFERENCES titles(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS holds_active_student_title_uq
  ON holds (tenant_id, title_id, student_ref)
  WHERE status IN ('queued', 'ready');

CREATE INDEX IF NOT EXISTS holds_tenant_title_idx
  ON holds (tenant_id, title_id, status);
