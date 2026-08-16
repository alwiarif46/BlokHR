-- 001_surveys: Parent/guardian school surveys (tenant-scoped).

CREATE TABLE IF NOT EXISTS surveys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  questions_json TEXT NOT NULL DEFAULT '[]',
  anonymous INTEGER NOT NULL DEFAULT 1,
  audience TEXT NOT NULL DEFAULT 'guardian',
  target_kind TEXT NOT NULL DEFAULT 'all',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS surveys_tenant_idx ON surveys (tenant_id);
CREATE INDEX IF NOT EXISTS surveys_tenant_status_idx ON surveys (tenant_id, status);

CREATE TABLE IF NOT EXISTS survey_targets (
  survey_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  student_ref TEXT NOT NULL,
  PRIMARY KEY (survey_id, student_ref),
  FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS survey_targets_tenant_idx ON survey_targets (tenant_id);

CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  survey_id TEXT NOT NULL,
  student_ref TEXT NOT NULL DEFAULT '',
  answers_json TEXT NOT NULL DEFAULT '{}',
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS survey_responses_survey_idx ON survey_responses (tenant_id, survey_id);

CREATE TABLE IF NOT EXISTS survey_completions (
  survey_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  guardian_ref TEXT NOT NULL,
  student_ref TEXT NOT NULL DEFAULT '',
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (survey_id, guardian_ref, student_ref),
  FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS survey_completions_guardian_idx ON survey_completions (tenant_id, guardian_ref);
