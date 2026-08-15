-- 027_training: Training / LMS module.
-- Courses, enrollment, completion tracking, skills, budgets, external training requests.

-- ── Course catalog ──
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  format TEXT NOT NULL DEFAULT 'doc'
    CHECK(format IN ('video', 'doc', 'link', 'scorm', 'classroom', 'other')),
  mandatory INTEGER NOT NULL DEFAULT 0,
  recurrence TEXT NOT NULL DEFAULT 'none'
    CHECK(recurrence IN ('none', 'annual', 'biannual', 'quarterly')),
  content_url TEXT NOT NULL DEFAULT '',
  file_id TEXT DEFAULT NULL,
  auto_assign_group_ids TEXT NOT NULL DEFAULT '',
  auto_assign_member_types TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
CREATE INDEX IF NOT EXISTS idx_courses_mandatory ON courses(mandatory);
CREATE INDEX IF NOT EXISTS idx_courses_active ON courses(active);

-- ── Enrollments (one per employee per course) ──
CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enrolled'
    CHECK(status IN ('enrolled', 'in_progress', 'completed', 'expired', 'dropped')),
  progress_pct INTEGER NOT NULL DEFAULT 0,
  score REAL DEFAULT NULL,
  enrolled_by TEXT NOT NULL DEFAULT '',
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  certificate_id TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(course_id, email)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_email ON enrollments(email);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);

-- ── Skills matrix ──
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employee_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency TEXT NOT NULL DEFAULT 'beginner'
    CHECK(proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK(source IN ('manual', 'course_completion', 'assessment')),
  source_id TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(email, skill_id)
);
CREATE INDEX IF NOT EXISTS idx_emp_skills_email ON employee_skills(email);
CREATE INDEX IF NOT EXISTS idx_emp_skills_skill ON employee_skills(skill_id);

-- Link courses to skills they teach
CREATE TABLE IF NOT EXISTS course_skills (
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency_granted TEXT NOT NULL DEFAULT 'beginner'
    CHECK(proficiency_granted IN ('beginner', 'intermediate', 'advanced', 'expert')),
  PRIMARY KEY(course_id, skill_id)
);

-- ── Training budget per department ──
CREATE TABLE IF NOT EXISTS training_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL UNIQUE REFERENCES groups(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  annual_budget REAL NOT NULL DEFAULT 0,
  spent REAL NOT NULL DEFAULT 0,
  per_employee_cap REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, year)
);

-- ── External training requests (2-tier approval like leaves) ──
CREATE TABLE IF NOT EXISTS external_training_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  cost REAL NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'manager_approved', 'approved', 'rejected')),
  manager_email TEXT NOT NULL DEFAULT '',
  hr_email TEXT NOT NULL DEFAULT '',
  rejection_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ext_training_email ON external_training_requests(email);
CREATE INDEX IF NOT EXISTS idx_ext_training_status ON external_training_requests(status);
