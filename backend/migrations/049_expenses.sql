-- Migration 049: Expenses domain enhancements
-- Rebuild expense_receipts with reimbursed status + multi-step level,
-- add expense_policies and expense_approvals, seed expense_mgmt feature flag.

-- ── Rebuild expense_receipts (SQLite cannot ALTER CHECK constraints) ──
CREATE TABLE IF NOT EXISTS expense_receipts_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  file_id TEXT DEFAULT NULL,
  vendor TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  receipt_date TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other'
    CHECK(category IN ('travel', 'meals', 'accommodation', 'supplies', 'client', 'other')),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft', 'submitted', 'approved', 'rejected', 'reimbursed')),
  current_level INTEGER NOT NULL DEFAULT 1,
  ocr_raw_json TEXT NOT NULL DEFAULT '{}',
  approver_email TEXT NOT NULL DEFAULT '',
  rejection_reason TEXT NOT NULL DEFAULT '',
  reimbursed_at TEXT,
  reimbursed_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO expense_receipts_new (
  id, email, file_id, vendor, amount, currency, receipt_date, category,
  description, status, current_level, ocr_raw_json, approver_email,
  rejection_reason, created_at, updated_at
)
SELECT
  id, email, file_id, vendor, amount, currency, receipt_date, category,
  description, status, 1, ocr_raw_json, approver_email,
  rejection_reason, created_at, updated_at
FROM expense_receipts;

DROP TABLE expense_receipts;
ALTER TABLE expense_receipts_new RENAME TO expense_receipts;

CREATE INDEX IF NOT EXISTS idx_receipts_email ON expense_receipts(email);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON expense_receipts(status);

-- ── Per-category expense policies (0 = unlimited) ──
CREATE TABLE IF NOT EXISTS expense_policies (
  category TEXT PRIMARY KEY
    CHECK(category IN ('travel', 'meals', 'accommodation', 'supplies', 'client', 'other')),
  max_amount_per_claim REAL NOT NULL DEFAULT 0,
  monthly_cap REAL NOT NULL DEFAULT 0,
  requires_receipt INTEGER NOT NULL DEFAULT 0 CHECK(requires_receipt IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO expense_policies (category, max_amount_per_claim, monthly_cap, requires_receipt, active)
VALUES
  ('travel', 0, 0, 0, 1),
  ('meals', 0, 0, 0, 1),
  ('accommodation', 0, 0, 0, 1),
  ('supplies', 0, 0, 0, 1),
  ('client', 0, 0, 0, 1),
  ('other', 0, 0, 0, 1);

-- ── Approval trail ──
CREATE TABLE IF NOT EXISTS expense_approvals (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL REFERENCES expense_receipts(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK(level >= 1),
  role TEXT NOT NULL DEFAULT 'manager',
  approver_email TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL CHECK(action IN ('approved', 'rejected')),
  reason TEXT NOT NULL DEFAULT '',
  acted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expense_approvals_receipt ON expense_approvals(receipt_id);

-- ── Feature flag ──
INSERT OR IGNORE INTO feature_flags (feature_key, label, description, category, enabled)
VALUES (
  'expense_mgmt',
  'Expenses & Approvals',
  'Expense claims, receipt capture, policy limits, and reimbursements',
  'operations',
  1
);
