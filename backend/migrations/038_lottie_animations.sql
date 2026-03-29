-- 038_lottie_animations: Table for per-clock-action Lottie animation files.
-- Admin uploads JSON animation files; all users see them on clock events.
-- file_data stores the full Lottie JSON (up to 2 MB).

CREATE TABLE IF NOT EXISTS lottie_animations (
  action          TEXT PRIMARY KEY CHECK(action IN ('clock-in', 'clock-out', 'break', 'back')),
  tenant_id       TEXT NOT NULL DEFAULT 'default',
  file_data       TEXT,
  file_name       TEXT,
  file_size_bytes INTEGER DEFAULT 0,
  duration_sec    INTEGER NOT NULL DEFAULT 3,
  enabled         INTEGER NOT NULL DEFAULT 0,
  uploaded_by     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed all 4 actions with empty/disabled defaults
INSERT OR IGNORE INTO lottie_animations (action, enabled) VALUES ('clock-in', 0);
INSERT OR IGNORE INTO lottie_animations (action, enabled) VALUES ('clock-out', 0);
INSERT OR IGNORE INTO lottie_animations (action, enabled) VALUES ('break', 0);
INSERT OR IGNORE INTO lottie_animations (action, enabled) VALUES ('back', 0);
