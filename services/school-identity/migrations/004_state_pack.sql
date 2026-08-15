-- Tenant state pack configuration and student state id

CREATE TABLE IF NOT EXISTS tenant_state_pack (
  tenant_id TEXT PRIMARY KEY,
  pack_code TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE students ADD COLUMN state_student_id TEXT;
