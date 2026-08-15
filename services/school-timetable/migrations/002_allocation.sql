-- Sections, subjects, allocations

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  academic_session_id TEXT NOT NULL,
  class_label TEXT NOT NULL,
  section TEXT NOT NULL,
  day_scheme_id TEXT NOT NULL,
  class_teacher_member_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sections_tenant ON sections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sections_session ON sections(tenant_id, academic_session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sections_unique
  ON sections(tenant_id, academic_session_id, class_label, section);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  is_elective INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subjects_tenant ON subjects(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_code ON subjects(tenant_id, code);

CREATE TABLE IF NOT EXISTS allocations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  teacher_member_id TEXT NOT NULL,
  periods_per_week INTEGER NOT NULL,
  room TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_allocations_tenant ON allocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_allocations_section ON allocations(tenant_id, section_id);
CREATE INDEX IF NOT EXISTS idx_allocations_subject ON allocations(tenant_id, subject_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_allocations_section_subject
  ON allocations(tenant_id, section_id, subject_id);
