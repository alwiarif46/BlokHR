-- Vehicle GPS pings (vehicles only — never person-tracking) + delay emit log

CREATE TABLE IF NOT EXISTS vehicle_pings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  speed_kmh REAL,
  at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vehicle_pings_vehicle_at
  ON vehicle_pings(tenant_id, vehicle_id, at);

CREATE TABLE IF NOT EXISTS delay_log (
  tenant_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  leg TEXT NOT NULL,
  delay_date TEXT NOT NULL,
  minutes_late INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, route_id, leg, delay_date)
);
