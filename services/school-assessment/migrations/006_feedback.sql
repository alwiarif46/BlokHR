-- Outcome performance feedback from published exams

CREATE TABLE IF NOT EXISTS outcome_performance (
  tenant_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  outcome_code TEXT NOT NULL,
  mean_pct REAL NOT NULL,
  n_students INTEGER NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, exam_id, outcome_code)
);

CREATE INDEX IF NOT EXISTS idx_outcome_performance_weak
  ON outcome_performance(tenant_id, mean_pct);
