-- Daily diary entries + guardian acks (P13-01)

CREATE TABLE IF NOT EXISTS diary_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  section_ref TEXT NOT NULL,
  student_ref TEXT,
  entry_date TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  attachment_refs_json TEXT,
  author_member_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_diary_entries_section_date
  ON diary_entries(tenant_id, section_ref, entry_date);

CREATE INDEX IF NOT EXISTS idx_diary_entries_student_date
  ON diary_entries(tenant_id, student_ref, entry_date);

CREATE TABLE IF NOT EXISTS diary_acks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  guardian_ref TEXT NOT NULL,
  student_ref TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (entry_id, guardian_ref, student_ref),
  FOREIGN KEY (entry_id) REFERENCES diary_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_diary_acks_entry
  ON diary_acks(tenant_id, entry_id);
