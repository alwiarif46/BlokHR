-- Family Hub: invitations, OTP recovery, household permissions, preferences, session audit

ALTER TABLE guardians ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE guardians ADD COLUMN accessibility_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE guardians ADD COLUMN privacy_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE guardians ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guardians ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guardians ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guardians ADD COLUMN mfa_secret_hash TEXT;

CREATE TABLE IF NOT EXISTS guardian_invitations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guardian_id TEXT NOT NULL,
  student_id TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_guardian_invitations_tenant_status
  ON guardian_invitations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_guardian_invitations_token
  ON guardian_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_guardian_invitations_phone
  ON guardian_invitations(tenant_id, phone);

-- Extend student_guardians with household permissions / restrictions
ALTER TABLE student_guardians ADD COLUMN can_view_education INTEGER NOT NULL DEFAULT 1;
ALTER TABLE student_guardians ADD COLUMN can_view_finance INTEGER NOT NULL DEFAULT 1;
ALTER TABLE student_guardians ADD COLUMN can_view_medical INTEGER NOT NULL DEFAULT 0;
ALTER TABLE student_guardians ADD COLUMN can_authorize_pickup INTEGER NOT NULL DEFAULT 1;
ALTER TABLE student_guardians ADD COLUMN is_emergency_contact INTEGER NOT NULL DEFAULT 0;
ALTER TABLE student_guardians ADD COLUMN is_delegated INTEGER NOT NULL DEFAULT 0;
ALTER TABLE student_guardians ADD COLUMN access_starts_on TEXT;
ALTER TABLE student_guardians ADD COLUMN access_ends_on TEXT;
ALTER TABLE student_guardians ADD COLUMN contact_restricted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE student_guardians ADD COLUMN custody_notes_ref TEXT;
ALTER TABLE student_guardians ADD COLUMN court_order_ref TEXT;

CREATE TABLE IF NOT EXISTS guardian_link_audit (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  guardian_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT '',
  details_json TEXT NOT NULL DEFAULT '{}',
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_guardian_link_audit_tenant
  ON guardian_link_audit(tenant_id, student_id, at);

CREATE TABLE IF NOT EXISTS guardian_session_audit (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guardian_id TEXT NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN ('login', 'logout', 'revoke', 'lockout', 'otp_sent', 'otp_verified', 'password_reset')),
  session_token_hash TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}',
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_guardian_session_audit_guardian
  ON guardian_session_audit(tenant_id, guardian_id, at);

CREATE TABLE IF NOT EXISTS guardian_otp_challenges (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guardian_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'reset', 'claim', 'verify_phone')),
  otp_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_guardian_otp_phone
  ON guardian_otp_challenges(phone, purpose, consumed);
