-- 035_tenant_settings_prefs: Unified tenant configuration + per-user preferences
-- Creates tenant_settings (single-row config with settings_json blob)
-- and member_preferences (per-user theme, colors, background, timezones).
-- Existing branding + system_settings tables are NOT dropped (backward compatible).

CREATE TABLE IF NOT EXISTS tenant_settings (
  id                  TEXT PRIMARY KEY DEFAULT 'default',
  platform_name       TEXT NOT NULL DEFAULT 'BlokHR',
  company_legal_name  TEXT,
  logo_data_url       TEXT,
  login_tagline       TEXT,
  primary_timezone    TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  version             TEXT,
  settings_json       TEXT NOT NULL DEFAULT '{}',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS member_preferences (
  member_id           TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL DEFAULT 'default',
  theme               TEXT NOT NULL DEFAULT 'chromium',
  dark_mode           TEXT NOT NULL DEFAULT 'system',
  color_accent        TEXT,
  color_status_in     TEXT,
  color_status_break  TEXT,
  color_status_absent TEXT,
  color_bg0           TEXT,
  color_tx            TEXT,
  bg_image_url        TEXT,
  bg_opacity          INTEGER NOT NULL DEFAULT 30,
  bg_blur             INTEGER NOT NULL DEFAULT 0,
  bg_darken           INTEGER NOT NULL DEFAULT 70,
  timezone_slot_1     TEXT,
  timezone_slot_2     TEXT,
  timezone_slot_3     TEXT,
  timezone_slot_4     TEXT,
  notification_prefs  TEXT,
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default row so tenant_settings always has a row to read
INSERT OR IGNORE INTO tenant_settings (id) VALUES ('default');

-- Migrate existing branding data into tenant_settings if available
UPDATE tenant_settings SET
  platform_name = (SELECT COALESCE(company_name, 'BlokHR') FROM branding LIMIT 1),
  logo_data_url = (SELECT COALESCE(logo_url, '') FROM branding LIMIT 1),
  login_tagline = (SELECT COALESCE(tagline, '') FROM branding LIMIT 1),
  primary_timezone = 'Asia/Kolkata',
  updated_at = datetime('now')
WHERE id = 'default' AND EXISTS (SELECT 1 FROM branding LIMIT 1);
