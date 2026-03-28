-- 025_org_chart: Position-based org hierarchy, reporting lines, succession planning.
-- Positions are independent of people. Members are assigned to positions.
-- Hierarchy lives on positions (parent_position_id). reports_to on members
-- enables direct manager resolution for approval routing.

-- ── Position hierarchy (independent of people) ──
CREATE TABLE IF NOT EXISTS org_positions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  parent_position_id TEXT REFERENCES org_positions(id) ON DELETE SET NULL,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  level INTEGER NOT NULL DEFAULT 0,
  max_headcount INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_org_positions_parent ON org_positions(parent_position_id);
CREATE INDEX IF NOT EXISTS idx_org_positions_group ON org_positions(group_id);

-- ── Link members to positions + direct reporting line ──
-- position_id: which org position this member fills
-- reports_to: email of direct manager (derived from position hierarchy or set directly)
ALTER TABLE members ADD COLUMN position_id TEXT DEFAULT NULL;
ALTER TABLE members ADD COLUMN reports_to TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_members_position ON members(position_id);
CREATE INDEX IF NOT EXISTS idx_members_reports_to ON members(reports_to);

-- ── Succession planning ──
-- Key positions × nominated successors × readiness level.
-- One nominee per position is unique. A nominee can appear on multiple positions.
CREATE TABLE IF NOT EXISTS succession_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position_id TEXT NOT NULL REFERENCES org_positions(id) ON DELETE CASCADE,
  nominee_email TEXT NOT NULL,
  readiness TEXT NOT NULL DEFAULT 'ready_now' CHECK(readiness IN ('ready_now', '1_year', '2_year')),
  notes TEXT NOT NULL DEFAULT '',
  nominated_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_succession_unique ON succession_plans(position_id, nominee_email);
CREATE INDEX IF NOT EXISTS idx_succession_nominee ON succession_plans(nominee_email);
CREATE INDEX IF NOT EXISTS idx_succession_position ON succession_plans(position_id);

-- ── System settings for org chart ──
ALTER TABLE system_settings ADD COLUMN org_chart_enabled INTEGER NOT NULL DEFAULT 1;
