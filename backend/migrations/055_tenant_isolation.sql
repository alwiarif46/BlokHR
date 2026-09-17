-- 055_tenant_isolation: per-tenant branding, credentials, admins.
-- Moves completed SI setup off singleton id=1 onto tenant_id='si',
-- and leaves tenant_id='default' empty so shared frontends get a fresh wizard.

-- ── Branding (rebuild without id=1 CHECK; keep all prior columns) ──
CREATE TABLE IF NOT EXISTS branding_mt (
  tenant_id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL DEFAULT '',
  tagline TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  favicon_url TEXT NOT NULL DEFAULT '',
  primary_color TEXT NOT NULL DEFAULT '#F5A623',
  email_from_name TEXT NOT NULL DEFAULT '',
  email_from_address TEXT NOT NULL DEFAULT '',
  card_footer_text TEXT NOT NULL DEFAULT '',
  custom_domain TEXT NOT NULL DEFAULT '',
  instance_name TEXT NOT NULL DEFAULT '',
  license_key TEXT NOT NULL DEFAULT '',
  license_valid INTEGER NOT NULL DEFAULT 0,
  setup_complete INTEGER NOT NULL DEFAULT 0,
  msal_client_id TEXT NOT NULL DEFAULT '',
  msal_tenant_id TEXT NOT NULL DEFAULT '',
  google_oauth_client_id TEXT NOT NULL DEFAULT '',
  storage_provider TEXT NOT NULL DEFAULT 'local',
  storage_local_path TEXT NOT NULL DEFAULT './uploads',
  storage_azure_connection_string TEXT NOT NULL DEFAULT '',
  storage_azure_container TEXT NOT NULL DEFAULT 'shaavir-files',
  storage_aws_region TEXT NOT NULL DEFAULT '',
  storage_aws_bucket TEXT NOT NULL DEFAULT '',
  storage_aws_access_key TEXT NOT NULL DEFAULT '',
  storage_aws_secret_key TEXT NOT NULL DEFAULT '',
  storage_max_file_size_mb INTEGER NOT NULL DEFAULT 25,
  redis_url TEXT NOT NULL DEFAULT '',
  event_retention_days INTEGER NOT NULL DEFAULT 90,
  auth_local_enabled INTEGER NOT NULL DEFAULT 1,
  oidc_enabled INTEGER NOT NULL DEFAULT 0,
  oidc_display_name TEXT NOT NULL DEFAULT 'SSO',
  oidc_issuer_url TEXT NOT NULL DEFAULT '',
  oidc_client_id TEXT NOT NULL DEFAULT '',
  oidc_client_secret TEXT NOT NULL DEFAULT '',
  oidc_scopes TEXT NOT NULL DEFAULT 'openid profile email',
  oidc_redirect_uri TEXT NOT NULL DEFAULT '',
  saml_enabled INTEGER NOT NULL DEFAULT 0,
  saml_display_name TEXT NOT NULL DEFAULT 'Enterprise SSO',
  saml_entry_point TEXT NOT NULL DEFAULT '',
  saml_issuer TEXT NOT NULL DEFAULT '',
  saml_cert TEXT NOT NULL DEFAULT '',
  saml_callback_url TEXT NOT NULL DEFAULT '',
  ldap_enabled INTEGER NOT NULL DEFAULT 0,
  ldap_display_name TEXT NOT NULL DEFAULT 'Corporate Login',
  ldap_url TEXT NOT NULL DEFAULT '',
  ldap_bind_dn TEXT NOT NULL DEFAULT '',
  ldap_bind_password TEXT NOT NULL DEFAULT '',
  ldap_search_base TEXT NOT NULL DEFAULT '',
  ldap_search_filter TEXT NOT NULL DEFAULT '(mail={{email}})',
  ldap_email_attribute TEXT NOT NULL DEFAULT 'mail',
  ldap_name_attribute TEXT NOT NULL DEFAULT 'cn',
  auth_magic_link_enabled INTEGER NOT NULL DEFAULT 0,
  storage_s3_endpoint TEXT NOT NULL DEFAULT '',
  storage_s3_path_style INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Preserve completed installs as tenant 'si'; incomplete → 'default'
INSERT OR IGNORE INTO branding_mt (
  tenant_id, company_name, tagline, logo_url, favicon_url, primary_color,
  email_from_name, email_from_address, card_footer_text, custom_domain,
  instance_name, license_key, license_valid, setup_complete,
  msal_client_id, msal_tenant_id, google_oauth_client_id,
  storage_provider, storage_local_path, storage_azure_connection_string,
  storage_azure_container, storage_aws_region, storage_aws_bucket,
  storage_aws_access_key, storage_aws_secret_key, storage_max_file_size_mb,
  redis_url, event_retention_days,
  auth_local_enabled, oidc_enabled, oidc_display_name, oidc_issuer_url,
  oidc_client_id, oidc_client_secret, oidc_scopes, oidc_redirect_uri,
  saml_enabled, saml_display_name, saml_entry_point, saml_issuer, saml_cert,
  saml_callback_url, ldap_enabled, ldap_display_name, ldap_url, ldap_bind_dn,
  ldap_bind_password, ldap_search_base, ldap_search_filter, ldap_email_attribute,
  ldap_name_attribute, auth_magic_link_enabled, storage_s3_endpoint,
  storage_s3_path_style, created_at, updated_at
)
SELECT
  CASE
    WHEN COALESCE(setup_complete, 0) = 1 AND TRIM(COALESCE(company_name, '')) != '' THEN 'si'
    WHEN TRIM(COALESCE(tenant_id, '')) != '' AND TRIM(COALESCE(tenant_id, '')) != 'default' THEN TRIM(tenant_id)
    ELSE 'default'
  END,
  COALESCE(company_name, ''),
  COALESCE(tagline, ''),
  COALESCE(logo_url, ''),
  COALESCE(favicon_url, ''),
  COALESCE(primary_color, '#F5A623'),
  COALESCE(email_from_name, ''),
  COALESCE(email_from_address, ''),
  COALESCE(card_footer_text, ''),
  COALESCE(custom_domain, ''),
  COALESCE(instance_name, ''),
  COALESCE(license_key, ''),
  COALESCE(license_valid, 0),
  COALESCE(setup_complete, 0),
  COALESCE(msal_client_id, ''),
  COALESCE(msal_tenant_id, ''),
  COALESCE(google_oauth_client_id, ''),
  COALESCE(storage_provider, 'local'),
  COALESCE(storage_local_path, './uploads'),
  COALESCE(storage_azure_connection_string, ''),
  COALESCE(storage_azure_container, 'shaavir-files'),
  COALESCE(storage_aws_region, ''),
  COALESCE(storage_aws_bucket, ''),
  COALESCE(storage_aws_access_key, ''),
  COALESCE(storage_aws_secret_key, ''),
  COALESCE(storage_max_file_size_mb, 25),
  COALESCE(redis_url, ''),
  COALESCE(event_retention_days, 90),
  COALESCE(auth_local_enabled, 1),
  COALESCE(oidc_enabled, 0),
  COALESCE(oidc_display_name, 'SSO'),
  COALESCE(oidc_issuer_url, ''),
  COALESCE(oidc_client_id, ''),
  COALESCE(oidc_client_secret, ''),
  COALESCE(oidc_scopes, 'openid profile email'),
  COALESCE(oidc_redirect_uri, ''),
  COALESCE(saml_enabled, 0),
  COALESCE(saml_display_name, 'Enterprise SSO'),
  COALESCE(saml_entry_point, ''),
  COALESCE(saml_issuer, ''),
  COALESCE(saml_cert, ''),
  COALESCE(saml_callback_url, ''),
  COALESCE(ldap_enabled, 0),
  COALESCE(ldap_display_name, 'Corporate Login'),
  COALESCE(ldap_url, ''),
  COALESCE(ldap_bind_dn, ''),
  COALESCE(ldap_bind_password, ''),
  COALESCE(ldap_search_base, ''),
  COALESCE(ldap_search_filter, '(mail={{email}})'),
  COALESCE(ldap_email_attribute, 'mail'),
  COALESCE(ldap_name_attribute, 'cn'),
  COALESCE(auth_magic_link_enabled, 0),
  COALESCE(storage_s3_endpoint, ''),
  COALESCE(storage_s3_path_style, 0),
  COALESCE(created_at, datetime('now')),
  COALESCE(updated_at, datetime('now'))
FROM branding
WHERE id = 1;

INSERT OR IGNORE INTO branding_mt (tenant_id, setup_complete) VALUES ('default', 0);

DROP TABLE branding;
ALTER TABLE branding_mt RENAME TO branding;

-- ── Auth credentials per tenant ──
CREATE TABLE IF NOT EXISTS auth_credentials_mt (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, email)
);

INSERT OR IGNORE INTO auth_credentials_mt (
  tenant_id, email, password_hash, must_change_password, failed_attempts,
  locked_until, last_login, created_at, updated_at
)
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM branding WHERE tenant_id = 'si' AND setup_complete = 1)
      THEN 'si'
    ELSE 'default'
  END,
  email, password_hash, must_change_password, failed_attempts,
  locked_until, last_login, created_at, updated_at
FROM auth_credentials;

DROP TABLE auth_credentials;
ALTER TABLE auth_credentials_mt RENAME TO auth_credentials;

-- ── Admins per tenant ──
CREATE TABLE IF NOT EXISTS admins_mt (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  email TEXT NOT NULL,
  PRIMARY KEY (tenant_id, email)
);

INSERT OR IGNORE INTO admins_mt (tenant_id, email)
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM branding WHERE tenant_id = 'si' AND setup_complete = 1)
      THEN 'si'
    ELSE 'default'
  END,
  email
FROM admins;

DROP TABLE admins;
ALTER TABLE admins_mt RENAME TO admins;

-- ── Tenant settings: copy default → si when SI branding exists; reset default vertical ──
INSERT OR IGNORE INTO tenant_settings (
  id, platform_name, company_legal_name, logo_data_url, login_tagline,
  primary_timezone, version, settings_json, created_at, updated_at
)
SELECT
  'si',
  platform_name, company_legal_name, logo_data_url, login_tagline,
  primary_timezone, version, settings_json, created_at, updated_at
FROM tenant_settings
WHERE id = 'default'
  AND EXISTS (SELECT 1 FROM branding WHERE tenant_id = 'si');

UPDATE tenant_settings
SET
  platform_name = 'BlokHR',
  company_legal_name = NULL,
  logo_data_url = NULL,
  login_tagline = NULL,
  settings_json = '{}',
  updated_at = datetime('now')
WHERE id = 'default'
  AND EXISTS (SELECT 1 FROM branding WHERE tenant_id = 'si');

INSERT OR IGNORE INTO tenant_settings (id) VALUES ('default');

-- Per-tenant setup step2 flag
INSERT OR IGNORE INTO kv_store (key, value_json)
SELECT 'setup_step2_complete:si', value_json
FROM kv_store
WHERE key = 'setup_step2_complete'
  AND EXISTS (SELECT 1 FROM branding WHERE tenant_id = 'si');

DELETE FROM kv_store
WHERE key = 'setup_step2_complete'
  AND EXISTS (SELECT 1 FROM branding WHERE tenant_id = 'si');

-- Session tokens carry tenant for gateway introspect
ALTER TABLE auth_sessions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

UPDATE auth_sessions
SET tenant_id = 'si'
WHERE EXISTS (SELECT 1 FROM branding WHERE tenant_id = 'si' AND setup_complete = 1);
