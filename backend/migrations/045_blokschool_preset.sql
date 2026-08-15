-- Migration 045: BlokSchool colour-scheme preset (W-03)
-- Adds a fourth seed row for the school vertical; follows 041 column shape.
-- SQLite: INSERT OR IGNORE. Postgres engine rewrites OR IGNORE → ON CONFLICT DO NOTHING.

INSERT OR IGNORE INTO colour_scheme_presets
  (id, name, accent, status_in, status_break, status_absent, bg0, tx, is_default)
VALUES
  ('csp-blokschool', 'BlokSchool', '#0ea5e9', '#2563eb', '#fbbf24', '#ef4444', '#0b1220', '#e2e8f0', 0);
