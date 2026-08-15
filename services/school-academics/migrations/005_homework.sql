-- Homework assignments + Classroom-style submissions

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  section_ref TEXT NOT NULL,
  topic_id TEXT,
  title TEXT NOT NULL,
  instructions TEXT,
  max_points INTEGER,
  due_at TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  attachment_refs_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assignments_tenant_course
  ON assignments(tenant_id, course_id, section_ref);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'assigned',
  late INTEGER NOT NULL DEFAULT 0,
  missing INTEGER NOT NULL DEFAULT 0,
  excused INTEGER NOT NULL DEFAULT 0,
  draft_grade REAL,
  assigned_grade REAL,
  feedback TEXT,
  attachment_refs_json TEXT NOT NULL DEFAULT '[]',
  turned_in_at TEXT,
  returned_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_assignment_student
  ON submissions(assignment_id, student_id);

CREATE INDEX IF NOT EXISTS idx_submissions_tenant
  ON submissions(tenant_id, assignment_id);
