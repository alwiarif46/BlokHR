-- Payments (integer paise) + UTR uniqueness

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  method TEXT NOT NULL,
  utr TEXT,
  gateway_ref TEXT,
  received_on TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_invoice
  ON payments(tenant_id, invoice_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_tenant_utr
  ON payments(tenant_id, utr)
  WHERE utr IS NOT NULL;
