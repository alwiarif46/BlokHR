-- 018_face_enrollment: Face recognition enrollment and identification tracking.

-- One row per employee enrolled in face recognition.
CREATE TABLE IF NOT EXISTS face_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  person_group_id TEXT NOT NULL DEFAULT 'shaavir-default',
  azure_person_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'enrolled', 'failed')),
  error_message TEXT NOT NULL DEFAULT '',
  enrolled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_face_email ON face_enrollments(email);
CREATE INDEX IF NOT EXISTS idx_face_status ON face_enrollments(status);

-- Face match confidence threshold (0.0–1.0, Azure recommends 0.5–0.7)
ALTER TABLE system_settings ADD COLUMN face_match_confidence_threshold REAL NOT NULL DEFAULT 0.6;

-- Person group ID for this installation
ALTER TABLE system_settings ADD COLUMN face_person_group_id TEXT NOT NULL DEFAULT 'shaavir-default';
