-- 030_assets: Asset management — inventory, assignment, depreciation, maintenance.

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  asset_tag TEXT NOT NULL UNIQUE,
  asset_type TEXT NOT NULL DEFAULT 'other'
    CHECK(asset_type IN ('laptop', 'phone', 'id_card', 'parking', 'furniture', 'monitor', 'other')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  serial_number TEXT NOT NULL DEFAULT '',
  purchase_date TEXT NOT NULL DEFAULT '',
  purchase_cost REAL NOT NULL DEFAULT 0,
  warranty_expiry TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'available'
    CHECK(status IN ('available', 'assigned', 'maintenance', 'retired')),
  depreciation_method TEXT NOT NULL DEFAULT 'straight_line'
    CHECK(depreciation_method IN ('straight_line', 'declining_balance', 'none')),
  useful_life_years INTEGER NOT NULL DEFAULT 3,
  location TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);

CREATE TABLE IF NOT EXISTS asset_assignments (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  assigned_date TEXT NOT NULL DEFAULT (datetime('now')),
  returned_date TEXT,
  condition_on_assign TEXT NOT NULL DEFAULT 'good',
  condition_on_return TEXT NOT NULL DEFAULT '',
  assigned_by TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assign_asset ON asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_assign_email ON asset_assignments(email);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  scheduled_date TEXT NOT NULL,
  completed_date TEXT,
  cost REAL NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_maint_asset ON maintenance_records(asset_id);
