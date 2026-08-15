-- 006_branding: Company branding and white-label configuration.
-- One row per install (single-tenant). Setup wizard populates this on first run.

CREATE TABLE IF NOT EXISTS branding (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  company_name TEXT NOT NULL DEFAULT '',
  tagline TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  favicon_url TEXT NOT NULL DEFAULT '',
  primary_color TEXT NOT NULL DEFAULT '#F5A623',
  email_from_name TEXT NOT NULL DEFAULT '',
  email_from_address TEXT NOT NULL DEFAULT '',
  card_footer_text TEXT NOT NULL DEFAULT '',
  custom_domain TEXT NOT NULL DEFAULT '',
  tenant_id TEXT NOT NULL DEFAULT '',
  instance_name TEXT NOT NULL DEFAULT '',
  license_key TEXT NOT NULL DEFAULT '',
  license_valid INTEGER NOT NULL DEFAULT 0,
  setup_complete INTEGER NOT NULL DEFAULT 0,
  msal_client_id TEXT NOT NULL DEFAULT '',
  msal_tenant_id TEXT NOT NULL DEFAULT '',
  google_oauth_client_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO branding (id) VALUES (1);
