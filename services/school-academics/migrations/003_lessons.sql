-- Lesson plans + weekly approval workflow

CREATE TABLE IF NOT EXISTS lesson_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  topic_id TEXT,
  teacher_member_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  title TEXT NOT NULL,
  body_json TEXT NOT NULL,
  kind TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft',
  reviewed_by TEXT,
  review_note TEXT,
  provenance TEXT NOT NULL DEFAULT 'human',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_filters
  ON lesson_plans(tenant_id, teacher_member_id, week_start, state, course_id);

CREATE TABLE IF NOT EXISTS lesson_outcomes (
  lesson_plan_id TEXT NOT NULL,
  outcome_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  PRIMARY KEY (lesson_plan_id, outcome_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_outcomes_tenant
  ON lesson_outcomes(tenant_id, lesson_plan_id);
