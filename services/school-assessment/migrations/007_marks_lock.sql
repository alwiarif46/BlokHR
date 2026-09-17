-- Phase 2: marks entry lock window + unlock audit

ALTER TABLE exams ADD COLUMN entry_closes_at TEXT;

CREATE TABLE IF NOT EXISTS exam_entry_unlocks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  unlocked_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  previous_closes_at TEXT,
  unlocked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exam_entry_unlocks_exam
  ON exam_entry_unlocks(tenant_id, exam_id);
