-- 001_kiosk_pins: Per-tenant hashed PINs for shared-device kiosk clock-in.

CREATE TABLE IF NOT EXISTS kiosk_pins (
  tenant_id TEXT NOT NULL,
  member_email TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, member_email)
);

CREATE INDEX IF NOT EXISTS idx_kiosk_pins_email ON kiosk_pins(member_email);
