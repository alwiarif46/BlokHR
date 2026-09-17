-- 056_members_tenant: scope monolith members by tenant_id.
-- Same SI-split rule as 055: completed SI branding → tenant 'si', else 'default'.

CREATE TABLE IF NOT EXISTS members_mt (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  member_type_id TEXT NOT NULL DEFAULT 'fte' REFERENCES member_types(id),
  role TEXT NOT NULL DEFAULT 'employee',
  designation TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  photo TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  emergency_contact TEXT NOT NULL DEFAULT '',
  joining_date TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  individual_shift_start TEXT,
  individual_shift_end TEXT,
  google_email TEXT NOT NULL DEFAULT '',
  google_is_shaavir INTEGER NOT NULL DEFAULT 0,
  teams_user_id TEXT NOT NULL DEFAULT '',
  ms_user_id TEXT NOT NULL DEFAULT '',
  pan_number TEXT NOT NULL DEFAULT '',
  aadhaar_number TEXT NOT NULL DEFAULT '',
  uan_number TEXT NOT NULL DEFAULT '',
  ac_parentage TEXT NOT NULL DEFAULT '',
  bank_account_number TEXT NOT NULL DEFAULT '',
  bank_ifsc TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',
  certified_at TEXT,
  certified_by TEXT NOT NULL DEFAULT '',
  profile_unlocked INTEGER NOT NULL DEFAULT 0,
  notification_config_json TEXT NOT NULL DEFAULT '{}',
  personal_webhook_url TEXT NOT NULL DEFAULT '',
  basic_salary REAL NOT NULL DEFAULT 0,
  da REAL NOT NULL DEFAULT 0,
  discord_id TEXT NOT NULL DEFAULT '',
  telegram_id TEXT NOT NULL DEFAULT '',
  position_id TEXT DEFAULT NULL,
  reports_to TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, email)
);

INSERT OR IGNORE INTO members_mt (
  tenant_id, id, email, name, group_id, member_type_id, role, designation, active,
  photo, phone, emergency_contact, joining_date, location, timezone,
  individual_shift_start, individual_shift_end,
  google_email, google_is_shaavir, teams_user_id, ms_user_id,
  pan_number, aadhaar_number, uan_number, ac_parentage,
  bank_account_number, bank_ifsc, bank_name,
  certified_at, certified_by, profile_unlocked, notification_config_json,
  personal_webhook_url, basic_salary, da, discord_id, telegram_id,
  position_id, reports_to, created_at, updated_at
)
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM branding WHERE tenant_id = 'si' AND setup_complete = 1)
      THEN 'si'
    ELSE 'default'
  END,
  id, email, name, group_id, member_type_id, role, designation, active,
  photo, phone, emergency_contact, joining_date, location, timezone,
  individual_shift_start, individual_shift_end,
  google_email, google_is_shaavir, teams_user_id, ms_user_id,
  pan_number, aadhaar_number, uan_number, ac_parentage,
  bank_account_number, bank_ifsc, bank_name,
  certified_at, certified_by, profile_unlocked, notification_config_json,
  personal_webhook_url,
  COALESCE(basic_salary, 0), COALESCE(da, 0),
  COALESCE(discord_id, ''), COALESCE(telegram_id, ''),
  position_id, COALESCE(reports_to, ''),
  created_at, updated_at
FROM members;

DROP TABLE members;
ALTER TABLE members_mt RENAME TO members;

CREATE INDEX IF NOT EXISTS idx_members_tenant_email ON members(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_members_tenant_active ON members(tenant_id, active);
