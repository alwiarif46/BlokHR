-- Student assignments, invoices, RTE claims (integer paise)

CREATE TABLE IF NOT EXISTS student_fee_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_ref TEXT NOT NULL,
  fee_structure_id TEXT NOT NULL,
  payer TEXT NOT NULL DEFAULT 'guardian',
  concession_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assignments_tenant_student
  ON student_fee_assignments(tenant_id, student_ref);

CREATE INDEX IF NOT EXISTS idx_assignments_tenant_structure
  ON student_fee_assignments(tenant_id, fee_structure_id);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_ref TEXT NOT NULL,
  payer TEXT NOT NULL,
  period_label TEXT NOT NULL,
  lines_json TEXT NOT NULL,
  total_paise INTEGER NOT NULL,
  status TEXT NOT NULL,
  due_on TEXT NOT NULL,
  issued_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_tenant_student_period
  ON invoices(tenant_id, student_ref, period_label);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status
  ON invoices(tenant_id, status);

CREATE TABLE IF NOT EXISTS rte_claims (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  period_label TEXT NOT NULL,
  invoice_ids_json TEXT NOT NULL,
  total_paise INTEGER NOT NULL,
  status TEXT NOT NULL,
  submitted_at TEXT,
  reference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rte_claims_tenant_period_state
  ON rte_claims(tenant_id, period_label, state_code);
