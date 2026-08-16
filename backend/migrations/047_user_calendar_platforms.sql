-- Migration 047: expand user_calendar_connections for Zoom/Webex/GoTo/BlueJeans
-- SQLite cannot ALTER CHECK constraints; recreate table.

CREATE TABLE IF NOT EXISTS user_calendar_connections_047 (
  id                  TEXT PRIMARY KEY,
  email               TEXT NOT NULL,
  provider            TEXT NOT NULL CHECK (provider IN (
                        'microsoft', 'google', 'zoom', 'webex', 'gotomeeting', 'bluejeans'
                      )),
  refresh_token_enc   TEXT NOT NULL DEFAULT '',
  access_token_enc    TEXT NOT NULL DEFAULT '',
  expires_at          TEXT,
  account_email       TEXT NOT NULL DEFAULT '',
  external_user_id    TEXT NOT NULL DEFAULT '',
  scopes              TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'revoked', 'error')),
  connected_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (email, provider)
);

INSERT INTO user_calendar_connections_047 (
  id, email, provider, refresh_token_enc, access_token_enc, expires_at,
  account_email, external_user_id, scopes, status, connected_at, updated_at
)
SELECT
  id, email, provider, refresh_token_enc, access_token_enc, expires_at,
  account_email, '', scopes, status, connected_at, updated_at
FROM user_calendar_connections;

DROP TABLE user_calendar_connections;
ALTER TABLE user_calendar_connections_047 RENAME TO user_calendar_connections;

CREATE INDEX IF NOT EXISTS idx_user_cal_conn_email ON user_calendar_connections(email);
CREATE INDEX IF NOT EXISTS idx_user_cal_conn_status ON user_calendar_connections(status);
