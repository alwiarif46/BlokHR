-- Migration 044: meeting_platform_config
-- Stores per-platform credentials as typed columns (no JSON blobs).
-- 4 rows seeded at startup, all disabled.
-- Env vars take priority at runtime; these are the DB fallback.
-- Secret columns are never returned in plain text by the API.

CREATE TABLE IF NOT EXISTS meeting_platform_config (
  platform               TEXT PRIMARY KEY
                           CHECK (platform IN ('zoom','webex','goto','bluejeans')),
  enabled                INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),

  -- Zoom (Server-to-Server OAuth)
  zoom_account_id        TEXT,
  zoom_client_id         TEXT,
  zoom_client_secret     TEXT,  -- secret

  -- Webex
  webex_bot_token        TEXT,  -- secret

  -- GoToMeeting
  goto_client_id         TEXT,
  goto_client_secret     TEXT,  -- secret

  -- BlueJeans
  bluejeans_api_key      TEXT,  -- secret

  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed all 4 platforms (disabled, no credentials)
INSERT OR IGNORE INTO meeting_platform_config (platform, enabled) VALUES
  ('zoom',       0),
  ('webex',      0),
  ('goto',       0),
  ('bluejeans',  0);
