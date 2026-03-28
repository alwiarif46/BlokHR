-- 005_notifications: Extended notification tracking for approval flows.

-- Tracks which adaptive card was sent for which entity, so we can update cards in-place.
CREATE TABLE IF NOT EXISTS notification_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,             -- 'leave', 'regularization', 'bd-meeting'
  entity_id TEXT NOT NULL,               -- leave request ID, reg ID, etc.
  channel TEXT NOT NULL,                 -- 'teams', 'slack', 'google-chat', etc.
  recipient_email TEXT NOT NULL,
  card_reference TEXT NOT NULL DEFAULT '', -- Teams: activity ID / conversation ID for in-place updates
  conversation_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_cards_entity ON notification_cards(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notif_cards_recipient ON notification_cards(recipient_email);
