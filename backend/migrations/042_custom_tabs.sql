-- Migration 042: custom_tabs + custom_tab_visibility
-- Stores admin-defined application tabs that appear in the sidebar.
-- Visibility can be restricted to specific group IDs via the join table.
-- sort_order determines display order; admin reorders via drag-and-drop or arrows.

CREATE TABLE IF NOT EXISTS custom_tabs (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  label      TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 30),
  src        TEXT NOT NULL DEFAULT '',
  icon       TEXT NOT NULL DEFAULT '',
  enabled    INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS custom_tab_visibility (
  tab_id   TEXT NOT NULL REFERENCES custom_tabs(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL,
  PRIMARY KEY (tab_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_tabs_sort        ON custom_tabs(sort_order);
CREATE INDEX IF NOT EXISTS idx_ctv_tab_id              ON custom_tab_visibility(tab_id);
CREATE INDEX IF NOT EXISTS idx_ctv_group_id            ON custom_tab_visibility(group_id);

-- No seed rows — admin creates tabs via UI
