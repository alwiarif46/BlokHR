-- 009_tracked_meetings: Tracked meetings with calendar sync and per-session attendance.
-- Meetings are auto-discovered from Teams/Google Calendar or added manually.
-- Attendance is recorded per meeting occurrence (meeting_id + session_date + email).

CREATE TABLE IF NOT EXISTS tracked_meetings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  join_url TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT 'manual' CHECK(platform IN ('teams', 'google-meet', 'zoom', 'webex', 'gotomeeting', 'bluejeans', 'manual')),
  client TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  added_by TEXT NOT NULL DEFAULT '',
  transcript TEXT NOT NULL DEFAULT '',
  recording TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tracked_meetings_enabled ON tracked_meetings(enabled);
CREATE INDEX IF NOT EXISTS idx_tracked_meetings_external ON tracked_meetings(external_id);

CREATE TABLE IF NOT EXISTS meeting_attendance (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES tracked_meetings(id),
  session_date TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  join_time TEXT NOT NULL DEFAULT '',
  leave_time TEXT NOT NULL DEFAULT '',
  total_seconds INTEGER NOT NULL DEFAULT 0,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  credit INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_meeting_att_meeting ON meeting_attendance(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_att_email ON meeting_attendance(email);
CREATE INDEX IF NOT EXISTS idx_meeting_att_session ON meeting_attendance(meeting_id, session_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_att_unique ON meeting_attendance(meeting_id, session_date, email);
