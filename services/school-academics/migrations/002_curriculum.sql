-- Curriculum tree: courses → units → topics + unit outcome tags

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  academic_session_id TEXT NOT NULL,
  board TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  class_label TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_courses_tenant
  ON courses(tenant_id);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  label TEXT NOT NULL,
  planned_weeks REAL NOT NULL,
  planned_start_week INTEGER,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_units_course
  ON units(tenant_id, course_id, sequence);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  label TEXT NOT NULL,
  estimated_periods INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_topics_unit
  ON topics(tenant_id, unit_id, sequence);

CREATE TABLE IF NOT EXISTS unit_outcomes (
  unit_id TEXT NOT NULL,
  outcome_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  field TEXT NOT NULL,
  depth TEXT NOT NULL DEFAULT 'introduced',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (unit_id, outcome_id, field)
);

CREATE INDEX IF NOT EXISTS idx_unit_outcomes_tenant
  ON unit_outcomes(tenant_id, unit_id);
