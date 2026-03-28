-- 036_platform_ids: discord_id, telegram_id columns on members

ALTER TABLE members ADD COLUMN discord_id TEXT NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN telegram_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_members_discord ON members(discord_id) WHERE discord_id != '';
CREATE INDEX IF NOT EXISTS idx_members_telegram ON members(telegram_id) WHERE telegram_id != '';
