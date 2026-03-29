-- 043_notification_channel_config: Per-channel credentials and enabled state.
-- Replaces env-var-only configuration. Server's getCredential() checks
-- env var first, then falls back to this table.
--
-- Column mapping per adapter:
--   Teams:       app_id, app_password
--   Slack:       bot_token, signing_secret
--   Google Chat: service_account_json
--   Discord:     bot_token, app_id
--   Telegram:    bot_token
--   WhatsApp:    phone_id, bot_token
--   ClickUp:     api_token
--   Email:       smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from,
--                server_base_url, action_link_secret

CREATE TABLE IF NOT EXISTS notification_channel_config (
  channel               TEXT PRIMARY KEY,         -- teams, slack, google_chat, discord, telegram, whatsapp, clickup, email
  enabled               INTEGER NOT NULL DEFAULT 0,
  bot_token             TEXT NOT NULL DEFAULT '',  -- Slack, Discord, Telegram, WhatsApp
  app_id                TEXT NOT NULL DEFAULT '',  -- Teams, Discord
  app_password          TEXT NOT NULL DEFAULT '',  -- Teams
  signing_secret        TEXT NOT NULL DEFAULT '',  -- Slack
  api_token             TEXT NOT NULL DEFAULT '',  -- ClickUp
  service_account_json  TEXT NOT NULL DEFAULT '',  -- Google Chat
  phone_id              TEXT NOT NULL DEFAULT '',  -- WhatsApp
  smtp_host             TEXT NOT NULL DEFAULT '',  -- Email
  smtp_port             INTEGER NOT NULL DEFAULT 587, -- Email
  smtp_user             TEXT NOT NULL DEFAULT '',  -- Email
  smtp_pass             TEXT NOT NULL DEFAULT '',  -- Email
  smtp_from             TEXT NOT NULL DEFAULT '',  -- Email
  server_base_url       TEXT NOT NULL DEFAULT '',  -- Email (for action links)
  action_link_secret    TEXT NOT NULL DEFAULT '',  -- Email (for action links)
  updated_by            TEXT NOT NULL DEFAULT '',
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed all 8 channels (disabled by default — admin enables + fills credentials)
INSERT OR IGNORE INTO notification_channel_config (channel) VALUES
  ('teams'),
  ('slack'),
  ('google_chat'),
  ('discord'),
  ('telegram'),
  ('whatsapp'),
  ('clickup'),
  ('email');
