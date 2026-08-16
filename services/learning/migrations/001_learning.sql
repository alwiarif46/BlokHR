-- 001_learning: LMS — courses, lessons, enrollments, skills, budgets, external requests.

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  level TEXT NOT NULL DEFAULT 'beginner'
    CHECK(level IN ('beginner', 'intermediate', 'advanced')),
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  format TEXT NOT NULL DEFAULT 'doc'
    CHECK(format IN ('video', 'doc', 'link', 'scorm', 'classroom', 'other')),
  mandatory INTEGER NOT NULL DEFAULT 0,
  recurrence TEXT NOT NULL DEFAULT 'none'
    CHECK(recurrence IN ('none', 'annual', 'biannual', 'quarterly')),
  content_url TEXT NOT NULL DEFAULT '',
  file_id TEXT DEFAULT NULL,
  thumbnail_url TEXT NOT NULL DEFAULT '',
  pass_score REAL DEFAULT NULL,
  valid_for_days INTEGER DEFAULT NULL,
  auto_assign_group_ids TEXT NOT NULL DEFAULT '',
  auto_assign_member_types TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft', 'published', 'archived')),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_courses_tenant ON courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_courses_tenant_status ON courses(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_courses_tenant_category ON courses(tenant_id, category);

CREATE TABLE IF NOT EXISTS course_lessons (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'doc'
    CHECK(type IN ('video', 'doc', 'link', 'scorm', 'quiz', 'classroom')),
  content_url TEXT NOT NULL DEFAULT '',
  file_id TEXT DEFAULT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  required INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(course_id, position)
);
CREATE INDEX IF NOT EXISTS idx_lessons_tenant ON course_lessons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON course_lessons(course_id);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
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
  due_date TEXT,
  expires_at TEXT,
  certificate_id TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(course_id, email)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_tenant ON enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_email ON enrollments(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(tenant_id, status);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK(status IN ('not_started', 'in_progress', 'completed')),
  completed_at TEXT,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(enrollment_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_enrollment ON lesson_progress(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_tenant ON lesson_progress(tenant_id);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, name)
);
CREATE INDEX IF NOT EXISTS idx_skills_tenant ON skills(tenant_id);

CREATE TABLE IF NOT EXISTS employee_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency TEXT NOT NULL DEFAULT 'beginner'
    CHECK(proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK(source IN ('manual', 'course_completion', 'assessment')),
  source_id TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, email, skill_id)
);
CREATE INDEX IF NOT EXISTS idx_emp_skills_email ON employee_skills(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_emp_skills_skill ON employee_skills(skill_id);

CREATE TABLE IF NOT EXISTS course_skills (
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency_granted TEXT NOT NULL DEFAULT 'beginner'
    CHECK(proficiency_granted IN ('beginner', 'intermediate', 'advanced', 'expert')),
  PRIMARY KEY(course_id, skill_id)
);

CREATE TABLE IF NOT EXISTS training_budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  annual_budget REAL NOT NULL DEFAULT 0,
  spent REAL NOT NULL DEFAULT 0,
  per_employee_cap REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, group_id, year)
);
CREATE INDEX IF NOT EXISTS idx_budgets_tenant ON training_budgets(tenant_id);

CREATE TABLE IF NOT EXISTS external_training_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_ext_training_tenant ON external_training_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ext_training_email ON external_training_requests(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_ext_training_status ON external_training_requests(tenant_id, status);
