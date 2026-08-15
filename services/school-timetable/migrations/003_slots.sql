-- Section timetable slot grid

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  day_ref TEXT NOT NULL,
  period_index INTEGER NOT NULL,
  allocation_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_slots_tenant ON slots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_slots_section ON slots(tenant_id, section_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_slots_section_cell
  ON slots(tenant_id, section_id, day_ref, period_index);
CREATE INDEX IF NOT EXISTS idx_slots_allocation ON slots(tenant_id, allocation_id);
