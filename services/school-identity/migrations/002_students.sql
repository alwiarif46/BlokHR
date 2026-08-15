-- Students, guardians, and enrolments (school-identity)
-- NOTE: one active enrolment per student per academic session is enforced in service code
-- (partial unique on exited_on IS NULL is deferred — do not rely on DB alone)

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  admission_number TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  admission_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('enquiry', 'admitted', 'active', 'transferred', 'alumni', 'withdrawn')),
  category TEXT NOT NULL CHECK (category IN ('GEN', 'EWS', 'OBC', 'SC', 'ST', 'OTHER_STATE')),
  state_category_code TEXT,
  mother_name TEXT NOT NULL,
  father_name TEXT NOT NULL,
  guardian_contact TEXT NOT NULL,
  aadhaar_last4 TEXT,
  apaar_id TEXT,
  pen_id TEXT,
  udise_export_ok INTEGER NOT NULL DEFAULT 0,
  is_cwsn INTEGER NOT NULL DEFAULT 0,
  cwsn_category TEXT,
  cwsn_disability TEXT,
  cwsn_certificate INTEGER NOT NULL DEFAULT 0,
  is_rte INTEGER NOT NULL DEFAULT 0,
  photo_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, admission_number)
);

CREATE TABLE IF NOT EXISTS guardians (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  relation TEXT NOT NULL CHECK (relation IN ('father', 'mother', 'guardian', 'other')),
  phone TEXT NOT NULL,
  email TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_guardians (
  student_id TEXT NOT NULL,
  guardian_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, guardian_id)
);

CREATE TABLE IF NOT EXISTS enrolments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  academic_session_id TEXT NOT NULL,
  class_label TEXT NOT NULL,
  section TEXT NOT NULL,
  roll_number TEXT NOT NULL,
  house TEXT,
  enrolled_on TEXT NOT NULL,
  exited_on TEXT,
  exit_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_students_tenant_status ON students(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_students_tenant_admission ON students(tenant_id, admission_number);
CREATE INDEX IF NOT EXISTS idx_enrolments_class ON enrolments(tenant_id, academic_session_id, class_label, section);
