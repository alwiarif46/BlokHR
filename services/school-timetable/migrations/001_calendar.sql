-- Calendar: terms, day schemes, exclusions

CREATE TABLE IF NOT EXISTS terms (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  academic_session_id TEXT NOT NULL,
  label TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_terms_tenant ON terms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_terms_session ON terms(tenant_id, academic_session_id);

CREATE TABLE IF NOT EXISTS day_schemes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  cycle_length INTEGER,
  periods_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_day_schemes_tenant ON day_schemes(tenant_id);

CREATE TABLE IF NOT EXISTS exclusions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  date TEXT NOT NULL,
  scope TEXT NOT NULL,
  class_label TEXT,
  reason TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exclusions_tenant_date ON exclusions(tenant_id, date);
