-- 028_workflows: Workflow builder — event-driven triggers, approval chains, SLA escalation.

-- ── Workflow definitions ──
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trigger_type TEXT NOT NULL DEFAULT 'manual'
    CHECK(trigger_type IN ('manual', 'event', 'scheduled')),
  trigger_config_json TEXT NOT NULL DEFAULT '{}',
  steps_json TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(active);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows(trigger_type);

-- ── Workflow instances (executions) ──
CREATE TABLE IF NOT EXISTS workflow_instances (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  trigger_data_json TEXT NOT NULL DEFAULT '{}',
  current_step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK(status IN ('running', 'completed', 'failed', 'cancelled')),
  started_by TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  step_history_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wf_instances_workflow ON workflow_instances(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wf_instances_status ON workflow_instances(status);

-- ── Form definitions (for workflow custom forms) ──
CREATE TABLE IF NOT EXISTS form_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  fields_json TEXT NOT NULL DEFAULT '[]',
  workflow_id TEXT REFERENCES workflows(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Form submissions ──
CREATE TABLE IF NOT EXISTS form_submissions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
  submitted_by TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  workflow_instance_id TEXT REFERENCES workflow_instances(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_form_subs_form ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_subs_by ON form_submissions(submitted_by);
