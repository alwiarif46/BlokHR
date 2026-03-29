-- 040_approval_flows: Multi-step approval workflows per entity type.
-- Replaces the settings_json.approvals blob with proper relational tables.

CREATE TABLE IF NOT EXISTS approval_flows (
  id                      TEXT PRIMARY KEY,
  entity_type             TEXT NOT NULL,          -- leave, regularization, overtime, expense, training
  auto_escalation_enabled INTEGER NOT NULL DEFAULT 0,
  auto_escalation_hours   INTEGER NOT NULL DEFAULT 48,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entity_type)
);

CREATE TABLE IF NOT EXISTS approval_steps (
  id                    TEXT PRIMARY KEY,
  flow_id               TEXT NOT NULL REFERENCES approval_flows(id) ON DELETE CASCADE,
  level                 INTEGER NOT NULL,         -- 1, 2, 3... (execution order)
  role                  TEXT NOT NULL DEFAULT 'manager',  -- manager, hr, director, ceo, custom
  escalate_after_hours  INTEGER NOT NULL DEFAULT 24,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(flow_id, level)
);

CREATE INDEX IF NOT EXISTS idx_approval_steps_flow ON approval_steps(flow_id);

-- Seed one default flow per entity type (single manager approval)
INSERT OR IGNORE INTO approval_flows (id, entity_type) VALUES
  ('af_leave',          'leave'),
  ('af_regularization', 'regularization'),
  ('af_overtime',       'overtime'),
  ('af_expense',        'expense'),
  ('af_training',       'training');

INSERT OR IGNORE INTO approval_steps (id, flow_id, level, role, escalate_after_hours) VALUES
  ('as_leave_1',          'af_leave',          1, 'manager', 24),
  ('as_regularization_1', 'af_regularization', 1, 'manager', 24),
  ('as_overtime_1',       'af_overtime',       1, 'manager', 24),
  ('as_expense_1',        'af_expense',        1, 'manager', 48),
  ('as_training_1',       'af_training',       1, 'manager', 48);
