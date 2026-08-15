-- 034_multi_auth: Multi-provider authentication + S3-compatible storage endpoint.

-- ── Local auth credentials (email + password) ──
CREATE TABLE IF NOT EXISTS auth_credentials (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Magic link tokens ──
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_magic_link_email ON magic_link_tokens(email);
CREATE INDEX IF NOT EXISTS idx_magic_link_token ON magic_link_tokens(token);

-- ── Auth provider config on branding ──
-- Existing: msal_client_id, msal_tenant_id, google_oauth_client_id
-- New: generic OIDC, SAML, LDAP, local auth toggle

-- Local email/password auth toggle
ALTER TABLE branding ADD COLUMN auth_local_enabled INTEGER NOT NULL DEFAULT 1;

-- Generic OIDC provider (Auth0, Okta, Oracle IDCS, Keycloak, OneLogin, PingIdentity)
ALTER TABLE branding ADD COLUMN oidc_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE branding ADD COLUMN oidc_display_name TEXT NOT NULL DEFAULT 'SSO';
ALTER TABLE branding ADD COLUMN oidc_issuer_url TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN oidc_client_id TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN oidc_client_secret TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN oidc_scopes TEXT NOT NULL DEFAULT 'openid profile email';
ALTER TABLE branding ADD COLUMN oidc_redirect_uri TEXT NOT NULL DEFAULT '';

-- SAML 2.0 SSO
ALTER TABLE branding ADD COLUMN saml_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE branding ADD COLUMN saml_display_name TEXT NOT NULL DEFAULT 'Enterprise SSO';
ALTER TABLE branding ADD COLUMN saml_entry_point TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN saml_issuer TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN saml_cert TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN saml_callback_url TEXT NOT NULL DEFAULT '';

-- LDAP / Active Directory
ALTER TABLE branding ADD COLUMN ldap_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE branding ADD COLUMN ldap_display_name TEXT NOT NULL DEFAULT 'Corporate Login';
ALTER TABLE branding ADD COLUMN ldap_url TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN ldap_bind_dn TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN ldap_bind_password TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN ldap_search_base TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN ldap_search_filter TEXT NOT NULL DEFAULT '(mail={{email}})';
ALTER TABLE branding ADD COLUMN ldap_email_attribute TEXT NOT NULL DEFAULT 'mail';
ALTER TABLE branding ADD COLUMN ldap_name_attribute TEXT NOT NULL DEFAULT 'cn';

-- Magic link toggle
ALTER TABLE branding ADD COLUMN auth_magic_link_enabled INTEGER NOT NULL DEFAULT 0;

-- ── S3-compatible endpoint config ──
-- Existing: storage_aws_region, storage_aws_bucket, storage_aws_access_key, storage_aws_secret_key
-- New: endpoint URL (for Cloudflare R2, Oracle Object Storage, MinIO, etc.) + path style toggle
ALTER TABLE branding ADD COLUMN storage_s3_endpoint TEXT NOT NULL DEFAULT '';
ALTER TABLE branding ADD COLUMN storage_s3_path_style INTEGER NOT NULL DEFAULT 0;

-- ── Seed default admin credentials (admin / admin) ──
-- Password hash for 'admin' using bcrypt with 10 rounds
-- $2a$10$ prefix = bcrypt version 2a, 10 rounds
-- This will be inserted by the setup service if auth_local_enabled
