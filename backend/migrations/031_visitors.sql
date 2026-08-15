-- 031_visitors: Visitor management — pre-registration, check-in/out, NDA forms.

CREATE TABLE IF NOT EXISTS visitor_visits (
  id TEXT PRIMARY KEY,
  visitor_name TEXT NOT NULL,
  visitor_company TEXT NOT NULL DEFAULT '',
  visitor_email TEXT NOT NULL DEFAULT '',
  visitor_phone TEXT NOT NULL DEFAULT '',
  host_email TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  expected_date TEXT NOT NULL,
  expected_time TEXT NOT NULL DEFAULT '',
  expected_duration_minutes INTEGER NOT NULL DEFAULT 60,
  actual_checkin TEXT,
  actual_checkout TEXT,
  reception_notes TEXT NOT NULL DEFAULT '',
  badge_data_json TEXT NOT NULL DEFAULT '{}',
  photo_file_id TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pre_registered'
    CHECK(status IN ('pre_registered', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_visits_host ON visitor_visits(host_email);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visitor_visits(expected_date);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visitor_visits(status);

CREATE TABLE IF NOT EXISTS visitor_forms (
  id TEXT PRIMARY KEY,
  visit_id TEXT NOT NULL REFERENCES visitor_visits(id) ON DELETE CASCADE,
  form_type TEXT NOT NULL DEFAULT 'nda'
    CHECK(form_type IN ('nda', 'safety', 'compliance', 'other')),
  signature_base64 TEXT NOT NULL DEFAULT '',
  file_id TEXT DEFAULT NULL,
  signed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vforms_visit ON visitor_forms(visit_id);
