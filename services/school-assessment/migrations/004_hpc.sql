-- HPC / PARAKH evidence store

CREATE TABLE IF NOT EXISTS competencies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  stage TEXT NOT NULL,
  ability TEXT NOT NULL,
  subject_area TEXT,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_competencies_stage
  ON competencies(stage, ability);

CREATE TABLE IF NOT EXISTS assessment_inputs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  competency_id TEXT NOT NULL,
  activity_ref TEXT,
  source TEXT NOT NULL,
  level TEXT,
  statements_circled INTEGER,
  observational_challenge TEXT,
  observational_resolution TEXT,
  evidence_ref TEXT,
  academic_session_ref TEXT,
  recorded_by TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assessment_inputs_student
  ON assessment_inputs(tenant_id, student_id, competency_id);

CREATE INDEX IF NOT EXISTS idx_assessment_inputs_session
  ON assessment_inputs(tenant_id, academic_session_ref, competency_id);
