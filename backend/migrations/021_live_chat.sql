-- 021_live_chat: Channels, memberships, feed messages, and direct messages.

-- Channels (company-wide, department, custom)
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom' CHECK(type IN ('company', 'department', 'custom')),
  description TEXT NOT NULL DEFAULT '',
  group_id TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(type);

-- Seed the company-wide channel
INSERT OR IGNORE INTO channels (id, name, type, description) VALUES
  ('company-feed', 'Company Feed', 'company', 'Company-wide announcements and updates');

-- Channel membership
CREATE TABLE IF NOT EXISTS channel_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member', 'admin')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(channel_id, email)
);
CREATE INDEX IF NOT EXISTS idx_ch_mem_channel ON channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_ch_mem_email ON channel_members(email);

-- Feed messages (posted to channels)
CREATE TABLE IF NOT EXISTS feed_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  sender_name TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'message' CHECK(message_type IN ('message', 'announcement', 'event')),
  pinned INTEGER NOT NULL DEFAULT 0,
  edited INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feed_msg_channel ON feed_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_feed_msg_sender ON feed_messages(sender_email);
CREATE INDEX IF NOT EXISTS idx_feed_msg_pinned ON feed_messages(pinned);
CREATE INDEX IF NOT EXISTS idx_feed_msg_created ON feed_messages(created_at);

-- Direct messages (1:1 between two users)
CREATE TABLE IF NOT EXISTS direct_messages (
  id TEXT PRIMARY KEY,
  sender_email TEXT NOT NULL,
  sender_name TEXT NOT NULL DEFAULT '',
  recipient_email TEXT NOT NULL,
  content TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_email);
CREATE INDEX IF NOT EXISTS idx_dm_recipient ON direct_messages(recipient_email);
CREATE INDEX IF NOT EXISTS idx_dm_read ON direct_messages(read);
CREATE INDEX IF NOT EXISTS idx_dm_created ON direct_messages(created_at);

-- Message read tracking for channel messages
CREATE TABLE IF NOT EXISTS message_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL REFERENCES feed_messages(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  read_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(message_id, email)
);
CREATE INDEX IF NOT EXISTS idx_msg_read_email ON message_reads(email);
