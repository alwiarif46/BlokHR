-- Fleet: vehicles, routes, stops, student assignments

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  registration TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  ais140_device_id TEXT,
  gps_provider TEXT,
  insurance_expiry TEXT NOT NULL,
  fitness_expiry TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_tenant_reg
  ON vehicles(tenant_id, registration);

CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  label TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  attendant_name TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_routes_tenant_vehicle
  ON routes(tenant_id, vehicle_id);

CREATE TABLE IF NOT EXISTS stops (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  label TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  pickup_time TEXT NOT NULL,
  drop_time TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stops_route_sequence
  ON stops(tenant_id, route_id, sequence);

CREATE TABLE IF NOT EXISTS route_students (
  route_id TEXT NOT NULL,
  stop_id TEXT NOT NULL,
  student_ref TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (route_id, student_ref)
);

CREATE INDEX IF NOT EXISTS idx_route_students_tenant_route
  ON route_students(tenant_id, route_id);
