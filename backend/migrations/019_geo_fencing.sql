-- 019_geo_fencing: Geo-fence zones, settings, and location-based clock logging.

-- Office locations / allowed clock-in zones.
CREATE TABLE IF NOT EXISTS geo_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_meters REAL NOT NULL DEFAULT 200,
  address TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Geo clock attempt log (audit trail for every location-based clock).
CREATE TABLE IF NOT EXISTS geo_clock_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  action TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy_meters REAL,
  matched_zone_id INTEGER REFERENCES geo_zones(id),
  matched_zone_name TEXT NOT NULL DEFAULT '',
  distance_meters REAL NOT NULL DEFAULT 0,
  inside_zone INTEGER NOT NULL DEFAULT 0,
  allowed INTEGER NOT NULL DEFAULT 0,
  denial_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_geo_log_email ON geo_clock_logs(email);
CREATE INDEX IF NOT EXISTS idx_geo_log_date ON geo_clock_logs(created_at);

-- Settings
ALTER TABLE system_settings ADD COLUMN geo_fencing_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE system_settings ADD COLUMN geo_fencing_strict INTEGER NOT NULL DEFAULT 0;
