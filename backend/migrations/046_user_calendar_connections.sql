-- Migration 046: user_calendar_connections
-- Per-user delegated OAuth connections for Microsoft / Google personal calendars.
-- Tokens are stored encrypted; personal events are NOT written to tracked_meetings.

CREATE TABLE IF NOT EXISTS user_calendar_connections (
  id                  TEXT PRIMARY KEY,
  email               TEXT NOT NULL,
  provider            TEXT NOT NULL CHECK (provider IN ('microsoft', 'google')),
  refresh_token_enc   TEXT NOT NULL DEFAULT '',
  access_token_enc    TEXT NOT NULL DEFAULT '',
  expires_at          TEXT,
  account_email       TEXT NOT NULL DEFAULT '',
  scopes              TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'revoked', 'error')),
  connected_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (email, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_cal_conn_email ON user_calendar_connections(email);
CREATE INDEX IF NOT EXISTS idx_user_cal_conn_status ON user_calendar_connections(status);
