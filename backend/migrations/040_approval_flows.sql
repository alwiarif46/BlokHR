-- Migration 040: approval_flows + approval_steps
-- Creates tables for multi-step, role-based approval workflows per entity type.
-- Seeds 5 default flows (leave, regularization, overtime, expense, training),
-- each with a single manager-level step. Admin can add/remove/reorder steps via UI.

CREATE TABLE IF NOT EXISTS approval_flows (
  id                       TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  entity_type              TEXT NOT NULL UNIQUE
                             CHECK (entity_type IN ('leave','regularization','overtime','expense','training')),
  auto_escalation_enabled  INTEGER NOT NULL DEFAULT 0 CHECK (auto_escalation_enabled IN (0,1)),
  auto_escalation_hours    INTEGER NOT NULL DEFAULT 24 CHECK (auto_escalation_hours BETWEEN 1 AND 168),
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS approval_steps (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  flow_id              TEXT NOT NULL REFERENCES approval_flows(id) ON DELETE CASCADE,
  level                INTEGER NOT NULL CHECK (level >= 1),
  role                 TEXT NOT NULL DEFAULT 'manager',
  escalate_after_hours INTEGER NOT NULL DEFAULT 24 CHECK (escalate_after_hours BETWEEN 1 AND 168),
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (flow_id, level)
);

CREATE INDEX IF NOT EXISTS idx_approval_steps_flow_id ON approval_steps(flow_id);

-- Seed 5 default flows
INSERT OR IGNORE INTO approval_flows (id, entity_type, auto_escalation_enabled, auto_escalation_hours)
VALUES
  ('flow-leave',          'leave',           0, 24),
  ('flow-reg',            'regularization',  0, 24),
  ('flow-overtime',       'overtime',        0, 24),
  ('flow-expense',        'expense',         0, 24),
  ('flow-training',       'training',        0, 48);

-- Seed one manager step per flow
INSERT OR IGNORE INTO approval_steps (id, flow_id, level, role, escalate_after_hours)
VALUES
  ('step-leave-1',    'flow-leave',     1, 'manager', 24),
  ('step-reg-1',      'flow-reg',       1, 'manager', 24),
  ('step-overtime-1', 'flow-overtime',  1, 'manager', 24),
  ('step-expense-1',  'flow-expense',   1, 'manager', 24),
  ('step-training-1', 'flow-training',  1, 'manager', 48);
