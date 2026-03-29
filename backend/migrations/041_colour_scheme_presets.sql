-- 041_colour_scheme_presets: Admin-created colour presets (up to 3).
-- Replaces settings_json.colourSchemes array with a proper table.

CREATE TABLE IF NOT EXISTS colour_scheme_presets (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  accent        TEXT NOT NULL DEFAULT '#F5A623',
  status_in     TEXT NOT NULL DEFAULT '#4CAF50',
  status_break  TEXT NOT NULL DEFAULT '#FF9800',
  status_absent TEXT NOT NULL DEFAULT '#F44336',
  bg0           TEXT NOT NULL DEFAULT '#0D1117',
  tx            TEXT NOT NULL DEFAULT '#E6EDF3',
  is_default    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed the 3 default presets matching the 4 built-in themes
INSERT OR IGNORE INTO colour_scheme_presets (id, name, accent, status_in, status_break, status_absent, bg0, tx, is_default) VALUES
  ('cs_chromium', 'Chromium Forge', '#F5A623', '#4CAF50', '#FF9800', '#F44336', '#0D1117', '#E6EDF3', 1),
  ('cs_neural',   'Neural Circuit', '#00E5FF', '#00E676', '#FFD740', '#FF5252', '#0A0E17', '#B0BEC5', 0),
  ('cs_clean',    'Clean Mode',     '#1976D2', '#43A047', '#FB8C00', '#E53935', '#FFFFFF', '#212121', 0);
