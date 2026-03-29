-- 044_meeting_platform_config: Per-platform meeting integration credentials.
-- Replaces env-var-only configuration. Server's getCredential() checks
-- env var first, then falls back to this table.
--
-- Column mapping per platform:
--   Zoom:        account_id, client_id, client_secret
--   Webex:       bot_token
--   GoToMeeting: client_id, client_secret
--   BlueJeans:   api_key

CREATE TABLE IF NOT EXISTS meeting_platform_config (
  platform        TEXT PRIMARY KEY,               -- zoom, webex, goto, bluejeans
  enabled         INTEGER NOT NULL DEFAULT 0,
  account_id      TEXT NOT NULL DEFAULT '',        -- Zoom
  client_id       TEXT NOT NULL DEFAULT '',        -- Zoom, GoTo
  client_secret   TEXT NOT NULL DEFAULT '',        -- Zoom, GoTo
  bot_token       TEXT NOT NULL DEFAULT '',        -- Webex
  api_key         TEXT NOT NULL DEFAULT '',        -- BlueJeans
  updated_by      TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed all 4 platforms (disabled by default)
INSERT OR IGNORE INTO meeting_platform_config (platform) VALUES
  ('zoom'),
  ('webex'),
  ('goto'),
  ('bluejeans');
