-- Exam terms and exams

CREATE TABLE IF NOT EXISTS exam_terms (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  academic_session_id TEXT NOT NULL,
  label TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  weightage_pct REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exam_terms_tenant_session
  ON exam_terms(tenant_id, academic_session_id);

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  exam_term_id TEXT NOT NULL,
  course_ref TEXT NOT NULL,
  section_ref TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  class_label TEXT NOT NULL,
  date TEXT NOT NULL,
  max_marks INTEGER NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exams_tenant_term
  ON exams(tenant_id, exam_term_id);
