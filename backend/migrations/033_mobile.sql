-- 033_mobile: Mobile-native features — push notifications, device registration,
-- biometric auth, location breadcrumbs, expense receipts.

-- ── Device tokens for push notifications (FCM + APNs) ──
CREATE TABLE IF NOT EXISTS device_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('android', 'ios', 'web')),
  token TEXT NOT NULL,
  app_version TEXT NOT NULL DEFAULT '',
  device_name TEXT NOT NULL DEFAULT '',
  last_active TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(email, token)
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_email ON device_tokens(email);
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON device_tokens(platform);

-- ── Biometric auth credentials (device attestation) ──
CREATE TABLE IF NOT EXISTS biometric_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT '',
  last_used TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_biometric_email ON biometric_credentials(email);

-- ── Location breadcrumbs (field employee tracking) ──
CREATE TABLE IF NOT EXISTS location_breadcrumbs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_breadcrumbs_email ON location_breadcrumbs(email);
CREATE INDEX IF NOT EXISTS idx_breadcrumbs_time ON location_breadcrumbs(recorded_at);

-- ── Expense receipts (photo capture + OCR extraction) ──
CREATE TABLE IF NOT EXISTS expense_receipts (
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
    CHECK(status IN ('draft', 'submitted', 'approved', 'rejected')),
  ocr_raw_json TEXT NOT NULL DEFAULT '{}',
  approver_email TEXT NOT NULL DEFAULT '',
  rejection_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_receipts_email ON expense_receipts(email);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON expense_receipts(status);

-- ── System settings for mobile ──
ALTER TABLE system_settings ADD COLUMN location_tracking_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE system_settings ADD COLUMN location_tracking_interval_seconds INTEGER NOT NULL DEFAULT 300;
