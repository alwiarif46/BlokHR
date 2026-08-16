-- Installed syllabus packs (P11). Upgrade path = install newer pack for a new session (no in-place mutation).

CREATE TABLE IF NOT EXISTS installed_packs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  pack_id TEXT NOT NULL,
  pack_status_at_install TEXT NOT NULL,
  academic_session_id TEXT NOT NULL,
  course_ids_json TEXT NOT NULL,
  installed_by TEXT NOT NULL,
  installed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_installed_packs_tenant
  ON installed_packs(tenant_id, installed_at DESC);
