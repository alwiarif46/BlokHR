ALTER TABLE library_settings ADD COLUMN fine_paise_per_day INTEGER NOT NULL DEFAULT 500;
ALTER TABLE library_settings ADD COLUMN fine_cap_paise INTEGER NOT NULL DEFAULT 20000;
ALTER TABLE library_settings ADD COLUMN grace_days INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS fines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  loan_id TEXT NOT NULL,
  student_ref TEXT NOT NULL,
  days_overdue INTEGER NOT NULL,
  amount_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  waived_reason TEXT,
  paid_on TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, loan_id),
  FOREIGN KEY (loan_id) REFERENCES loans(id)
);

CREATE INDEX IF NOT EXISTS fines_tenant_student_idx
  ON fines (tenant_id, student_ref);

CREATE INDEX IF NOT EXISTS fines_tenant_status_idx
  ON fines (tenant_id, status);
