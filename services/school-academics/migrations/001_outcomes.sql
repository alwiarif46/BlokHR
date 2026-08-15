-- Learning outcomes catalogue + crosswalk (global NCERT + tenant custom)

CREATE TABLE IF NOT EXISTS learning_outcomes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  code TEXT NOT NULL,
  class_label TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  description TEXT NOT NULL,
  framework TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_outcomes_scope_code
  ON learning_outcomes(COALESCE(tenant_id, 'global'), code);

CREATE INDEX IF NOT EXISTS idx_learning_outcomes_filters
  ON learning_outcomes(class_label, subject_code, framework);

CREATE TABLE IF NOT EXISTS outcome_crosswalk (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  from_outcome_id TEXT NOT NULL,
  to_outcome_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_outcome_crosswalk_tenant
  ON outcome_crosswalk(tenant_id);
