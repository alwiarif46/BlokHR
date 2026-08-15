-- Migration 043: notification_channel_config
-- Stores per-channel credentials as typed columns (no JSON blobs).
-- 8 rows are seeded at startup, all disabled.
-- Env vars take priority at runtime; these columns are the DB fallback.
-- Secret columns (tokens, passwords, keys) are never returned in plain text by the API.

CREATE TABLE IF NOT EXISTS notification_channel_config (
  channel             TEXT PRIMARY KEY
                        CHECK (channel IN ('teams','slack','google_chat','discord','telegram','whatsapp','clickup','email')),
  enabled             INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),

  -- Teams Bot Framework
  teams_app_id        TEXT,
  teams_app_password  TEXT,  -- secret

  -- Slack
  slack_bot_token     TEXT,  -- secret
  slack_signing_secret TEXT, -- secret

  -- Google Chat
  google_service_account_json TEXT, -- secret (large)

  -- Discord
  discord_bot_token   TEXT,  -- secret
  discord_app_id      TEXT,

  -- Telegram
  telegram_bot_token  TEXT,  -- secret

  -- WhatsApp (Meta Cloud API)
  whatsapp_phone_id   TEXT,
  whatsapp_token      TEXT,  -- secret

  -- ClickUp
  clickup_api_token   TEXT,  -- secret

  -- Email / SMTP
  smtp_host           TEXT,
  smtp_port           INTEGER NOT NULL DEFAULT 587,
  smtp_user           TEXT,
  smtp_pass           TEXT,  -- secret
  smtp_from           TEXT,
  smtp_server_base_url TEXT,
  smtp_action_link_secret TEXT, -- secret

  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed all 8 channels (disabled, no credentials)
INSERT OR IGNORE INTO notification_channel_config (channel, enabled) VALUES
  ('teams',       0),
  ('slack',       0),
  ('google_chat', 0),
  ('discord',     0),
  ('telegram',    0),
  ('whatsapp',    0),
  ('clickup',     0),
  ('email',       0);
