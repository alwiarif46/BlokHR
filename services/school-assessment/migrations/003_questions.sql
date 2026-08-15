-- Question bank, blueprints, papers

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  class_label TEXT NOT NULL,
  outcome_code TEXT,
  kind TEXT NOT NULL,
  competency_style INTEGER NOT NULL DEFAULT 0,
  marks INTEGER NOT NULL,
  body_json TEXT NOT NULL,
  answer_json TEXT,
  provenance TEXT NOT NULL DEFAULT 'human',
  times_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_questions_tenant_filters
  ON questions(tenant_id, subject_code, class_label, kind);

CREATE TABLE IF NOT EXISTS blueprints (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  label TEXT NOT NULL,
  class_label TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  total_marks INTEGER NOT NULL,
  rules_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_blueprints_tenant
  ON blueprints(tenant_id, subject_code, class_label);

CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  blueprint_id TEXT NOT NULL,
  exam_ref TEXT,
  question_ids_json TEXT NOT NULL,
  generated_variant_of TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_papers_tenant_blueprint
  ON papers(tenant_id, blueprint_id);
