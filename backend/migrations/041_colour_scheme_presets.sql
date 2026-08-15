-- Migration 041: colour_scheme_presets
-- Stores up to 3 admin-defined colour scheme presets.
-- Each preset defines all 6 theme colour variables.
-- Exactly one row has is_default = 1 at all times (enforced by application logic).

CREATE TABLE IF NOT EXISTS colour_scheme_presets (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name         TEXT NOT NULL,
  accent       TEXT NOT NULL DEFAULT '#00e59a' CHECK (accent GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'),
  status_in    TEXT NOT NULL DEFAULT '#3b82f6' CHECK (status_in GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'),
  status_break TEXT NOT NULL DEFAULT '#fbbf24' CHECK (status_break GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'),
  status_absent TEXT NOT NULL DEFAULT '#ef4444' CHECK (status_absent GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'),
  bg0          TEXT NOT NULL DEFAULT '#0c0d0f' CHECK (bg0 GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'),
  tx           TEXT NOT NULL DEFAULT '#d8dde5' CHECK (tx GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'),
  is_default   INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed 3 presets matching the 3 dark themes
INSERT OR IGNORE INTO colour_scheme_presets
  (id, name, accent, status_in, status_break, status_absent, bg0, tx, is_default)
VALUES
  ('csp-chromium', 'Chromium Forge', '#00e59a', '#3b82f6', '#fbbf24', '#ef4444', '#0c0d0f', '#d8dde5', 1),
  ('csp-neural',   'Neural Circuit',  '#0aff6a', '#3b82f6', '#fbbf24', '#ef4444', '#020a04', '#c8f5d8', 0),
  ('csp-clean',    'Clean Mode',      '#6366f1', '#2563eb', '#d97706', '#dc2626', '#fafbfc', '#111827', 0);
