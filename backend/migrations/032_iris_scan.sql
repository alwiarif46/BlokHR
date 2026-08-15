-- 032_iris_scan: Iris scan clock-in — enrollment, server-side template matching.

CREATE TABLE IF NOT EXISTS iris_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  iris_template TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'enrolled', 'failed')),
  error_message TEXT NOT NULL DEFAULT '',
  enrolled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_iris_email ON iris_enrollments(email);
CREATE INDEX IF NOT EXISTS idx_iris_status ON iris_enrollments(status);

-- Configurable match threshold (Hamming distance, default 0.32 = standard FAR)
ALTER TABLE system_settings ADD COLUMN iris_match_threshold REAL NOT NULL DEFAULT 0.32;
