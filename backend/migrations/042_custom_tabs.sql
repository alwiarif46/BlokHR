-- 042_custom_tabs: Admin-defined sidebar/dashboard tabs with per-group visibility.
-- Replaces settings_json.tabs array with proper relational tables.

CREATE TABLE IF NOT EXISTS custom_tabs (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  src         TEXT NOT NULL DEFAULT '',          -- URL or route path
  icon        TEXT NOT NULL DEFAULT '',          -- emoji or icon class
  enabled     INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Which groups can see each tab. No rows = visible to all.
CREATE TABLE IF NOT EXISTS custom_tab_visibility (
  tab_id    TEXT NOT NULL REFERENCES custom_tabs(id) ON DELETE CASCADE,
  group_id  TEXT NOT NULL,
  PRIMARY KEY (tab_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_tab_visibility_tab ON custom_tab_visibility(tab_id);
