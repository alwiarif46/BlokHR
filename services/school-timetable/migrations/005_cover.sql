-- Teacher absences and substitute cover assignments

CREATE TABLE IF NOT EXISTS teacher_absences (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  teacher_member_id TEXT NOT NULL,
  date TEXT NOT NULL,
  period_indexes_json TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_teacher_absences_tenant_date
  ON teacher_absences(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_teacher_absences_teacher
  ON teacher_absences(tenant_id, teacher_member_id, date);

CREATE TABLE IF NOT EXISTS cover_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  absence_id TEXT NOT NULL,
  period_instance_id TEXT NOT NULL,
  cover_teacher_member_id TEXT,
  state TEXT NOT NULL,
  offered_at TEXT,
  responded_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cover_assignments_tenant ON cover_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cover_assignments_absence ON cover_assignments(tenant_id, absence_id);
CREATE INDEX IF NOT EXISTS idx_cover_assignments_instance
  ON cover_assignments(tenant_id, period_instance_id);
CREATE INDEX IF NOT EXISTS idx_cover_assignments_state_date
  ON cover_assignments(tenant_id, state);
