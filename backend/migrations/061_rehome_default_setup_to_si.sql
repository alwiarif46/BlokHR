-- 061_rehome_default_setup_to_si.sql
-- Repair: completed org still living on tenant `default` (wizard skipped on
-- blokhr.vercel.app). Migration 055 was supposed to park completed installs on
-- `si` and leave `default` with setup_complete=0. Re-apply that contract when
-- `default` is complete and `si` is not (or both hold the same company).

INSERT OR IGNORE INTO branding (tenant_id, setup_complete) VALUES ('si', 0);
INSERT OR IGNORE INTO tenant_settings (id) VALUES ('si');
INSERT OR IGNORE INTO tenant_settings (id) VALUES ('default');

-- 1) Copy branding default → si when si is incomplete and default is complete
UPDATE branding
SET
  company_name = (SELECT company_name FROM branding WHERE tenant_id = 'default'),
  tagline = (SELECT tagline FROM branding WHERE tenant_id = 'default'),
  logo_url = (SELECT logo_url FROM branding WHERE tenant_id = 'default'),
  favicon_url = (SELECT favicon_url FROM branding WHERE tenant_id = 'default'),
  primary_color = (SELECT primary_color FROM branding WHERE tenant_id = 'default'),
  email_from_name = (SELECT email_from_name FROM branding WHERE tenant_id = 'default'),
  email_from_address = (SELECT email_from_address FROM branding WHERE tenant_id = 'default'),
  card_footer_text = (SELECT card_footer_text FROM branding WHERE tenant_id = 'default'),
  custom_domain = (SELECT custom_domain FROM branding WHERE tenant_id = 'default'),
  instance_name = (SELECT instance_name FROM branding WHERE tenant_id = 'default'),
  license_key = (SELECT license_key FROM branding WHERE tenant_id = 'default'),
  license_valid = (SELECT license_valid FROM branding WHERE tenant_id = 'default'),
  setup_complete = 1,
  msal_client_id = (SELECT msal_client_id FROM branding WHERE tenant_id = 'default'),
  msal_tenant_id = (SELECT msal_tenant_id FROM branding WHERE tenant_id = 'default'),
  google_oauth_client_id = (SELECT google_oauth_client_id FROM branding WHERE tenant_id = 'default'),
  auth_local_enabled = (SELECT auth_local_enabled FROM branding WHERE tenant_id = 'default'),
  auth_magic_link_enabled = (SELECT auth_magic_link_enabled FROM branding WHERE tenant_id = 'default'),
  updated_at = datetime('now')
WHERE tenant_id = 'si'
  AND COALESCE(setup_complete, 0) = 0
  AND EXISTS (
    SELECT 1 FROM branding d
    WHERE d.tenant_id = 'default'
      AND COALESCE(d.setup_complete, 0) = 1
      AND TRIM(COALESCE(d.company_name, '')) != ''
  );

-- Shared-org gate for remaining steps: both tenants complete with the same company
-- (true after step 1, or when default was a duplicate of an existing si install).

-- 2) Move identity rows from default → si
UPDATE auth_credentials
SET tenant_id = 'si'
WHERE tenant_id = 'default'
  AND EXISTS (
    SELECT 1
    FROM branding s
    JOIN branding d ON d.tenant_id = 'default'
    WHERE s.tenant_id = 'si'
      AND COALESCE(s.setup_complete, 0) = 1
      AND COALESCE(d.setup_complete, 0) = 1
      AND TRIM(COALESCE(s.company_name, '')) != ''
      AND TRIM(s.company_name) = TRIM(d.company_name)
  );

UPDATE admins
SET tenant_id = 'si'
WHERE tenant_id = 'default'
  AND EXISTS (
    SELECT 1
    FROM branding s
    JOIN branding d ON d.tenant_id = 'default'
    WHERE s.tenant_id = 'si'
      AND COALESCE(s.setup_complete, 0) = 1
      AND COALESCE(d.setup_complete, 0) = 1
      AND TRIM(COALESCE(s.company_name, '')) != ''
      AND TRIM(s.company_name) = TRIM(d.company_name)
  );

UPDATE members
SET tenant_id = 'si'
WHERE tenant_id = 'default'
  AND EXISTS (
    SELECT 1
    FROM branding s
    JOIN branding d ON d.tenant_id = 'default'
    WHERE s.tenant_id = 'si'
      AND COALESCE(s.setup_complete, 0) = 1
      AND COALESCE(d.setup_complete, 0) = 1
      AND TRIM(COALESCE(s.company_name, '')) != ''
      AND TRIM(s.company_name) = TRIM(d.company_name)
  );

UPDATE auth_sessions
SET tenant_id = 'si'
WHERE tenant_id = 'default'
  AND EXISTS (
    SELECT 1
    FROM branding s
    JOIN branding d ON d.tenant_id = 'default'
    WHERE s.tenant_id = 'si'
      AND COALESCE(s.setup_complete, 0) = 1
      AND COALESCE(d.setup_complete, 0) = 1
      AND TRIM(COALESCE(s.company_name, '')) != ''
      AND TRIM(s.company_name) = TRIM(d.company_name)
  );

-- 3) Copy tenant_settings default → si
UPDATE tenant_settings
SET
  platform_name = (SELECT platform_name FROM tenant_settings WHERE id = 'default'),
  company_legal_name = (SELECT company_legal_name FROM tenant_settings WHERE id = 'default'),
  logo_data_url = (SELECT logo_data_url FROM tenant_settings WHERE id = 'default'),
  login_tagline = (SELECT login_tagline FROM tenant_settings WHERE id = 'default'),
  primary_timezone = (SELECT primary_timezone FROM tenant_settings WHERE id = 'default'),
  version = (SELECT version FROM tenant_settings WHERE id = 'default'),
  settings_json = (SELECT settings_json FROM tenant_settings WHERE id = 'default'),
  updated_at = datetime('now')
WHERE id = 'si'
  AND EXISTS (
    SELECT 1
    FROM branding s
    JOIN branding d ON d.tenant_id = 'default'
    WHERE s.tenant_id = 'si'
      AND COALESCE(s.setup_complete, 0) = 1
      AND COALESCE(d.setup_complete, 0) = 1
      AND TRIM(COALESCE(s.company_name, '')) != ''
      AND TRIM(s.company_name) = TRIM(d.company_name)
  );

INSERT OR IGNORE INTO kv_store (key, value_json)
SELECT 'setup_step2_complete:si', value_json
FROM kv_store
WHERE key IN ('setup_step2_complete', 'setup_step2_complete:default')
  AND EXISTS (
    SELECT 1
    FROM branding s
    JOIN branding d ON d.tenant_id = 'default'
    WHERE s.tenant_id = 'si'
      AND COALESCE(s.setup_complete, 0) = 1
      AND COALESCE(d.setup_complete, 0) = 1
      AND TRIM(COALESCE(s.company_name, '')) != ''
      AND TRIM(s.company_name) = TRIM(d.company_name)
  );

-- 4) Reset default so Host-mapped blokhr.vercel.app shows the onboarding wizard
UPDATE branding
SET
  company_name = '',
  tagline = '',
  logo_url = '',
  favicon_url = '',
  primary_color = '#F5A623',
  email_from_name = '',
  email_from_address = '',
  card_footer_text = '',
  custom_domain = '',
  instance_name = '',
  license_key = '',
  license_valid = 0,
  setup_complete = 0,
  msal_client_id = '',
  msal_tenant_id = '',
  google_oauth_client_id = '',
  auth_local_enabled = 1,
  auth_magic_link_enabled = 0,
  updated_at = datetime('now')
WHERE tenant_id = 'default'
  AND EXISTS (
    SELECT 1
    FROM branding s
    JOIN branding d ON d.tenant_id = 'default'
    WHERE s.tenant_id = 'si'
      AND COALESCE(s.setup_complete, 0) = 1
      AND COALESCE(d.setup_complete, 0) = 1
      AND TRIM(COALESCE(s.company_name, '')) != ''
      AND TRIM(s.company_name) = TRIM(d.company_name)
  );

UPDATE tenant_settings
SET
  platform_name = 'BlokHR',
  company_legal_name = NULL,
  logo_data_url = NULL,
  login_tagline = NULL,
  settings_json = '{}',
  updated_at = datetime('now')
WHERE id = 'default'
  AND EXISTS (SELECT 1 FROM branding WHERE tenant_id = 'si' AND setup_complete = 1)
  AND EXISTS (
    SELECT 1 FROM branding
    WHERE tenant_id = 'default'
      AND COALESCE(setup_complete, 0) = 0
      AND TRIM(COALESCE(company_name, '')) = ''
  );

DELETE FROM kv_store
WHERE key IN ('setup_step2_complete', 'setup_step2_complete:default')
  AND EXISTS (SELECT 1 FROM branding WHERE tenant_id = 'si' AND setup_complete = 1)
  AND EXISTS (
    SELECT 1 FROM branding
    WHERE tenant_id = 'default'
      AND COALESCE(setup_complete, 0) = 0
  );
