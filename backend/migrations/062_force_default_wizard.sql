-- 062_force_default_wizard.sql
-- 061 no-oped when `si` was already setup_complete=1 with a different/empty
-- company_name while `default` still held the live org (Hanfia). Force the
-- documented contract: blokhr.vercel.app → tenant `default` → wizard open.

INSERT OR IGNORE INTO branding (tenant_id, setup_complete) VALUES ('si', 0);
INSERT OR IGNORE INTO tenant_settings (id) VALUES ('si');
INSERT OR IGNORE INTO tenant_settings (id) VALUES ('default');

-- Preserve default's completed branding onto si when si has no real company yet,
-- or already matches default's company (safe overwrite / fill-in).
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
  AND EXISTS (
    SELECT 1 FROM branding d
    WHERE d.tenant_id = 'default'
      AND COALESCE(d.setup_complete, 0) = 1
      AND TRIM(COALESCE(d.company_name, '')) != ''
  )
  AND (
    TRIM(COALESCE(company_name, '')) = ''
    OR TRIM(company_name) = (
      SELECT TRIM(company_name) FROM branding WHERE tenant_id = 'default'
    )
  );

-- Move identity rows that still belong to the completed default org
UPDATE auth_credentials
SET tenant_id = 'si'
WHERE tenant_id = 'default'
  AND EXISTS (
    SELECT 1 FROM branding
    WHERE tenant_id = 'default' AND COALESCE(setup_complete, 0) = 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM auth_credentials c2
    WHERE c2.tenant_id = 'si' AND c2.email = auth_credentials.email
  );

UPDATE admins
SET tenant_id = 'si'
WHERE tenant_id = 'default'
  AND EXISTS (
    SELECT 1 FROM branding
    WHERE tenant_id = 'default' AND COALESCE(setup_complete, 0) = 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM admins a2
    WHERE a2.tenant_id = 'si' AND a2.email = admins.email
  );

UPDATE members
SET tenant_id = 'si'
WHERE tenant_id = 'default'
  AND EXISTS (
    SELECT 1 FROM branding
    WHERE tenant_id = 'default' AND COALESCE(setup_complete, 0) = 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM members m2
    WHERE m2.tenant_id = 'si' AND m2.email = members.email
  );

UPDATE auth_sessions
SET tenant_id = 'si'
WHERE tenant_id = 'default'
  AND EXISTS (
    SELECT 1 FROM branding
    WHERE tenant_id = 'default' AND COALESCE(setup_complete, 0) = 1
  );

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
    SELECT 1 FROM branding
    WHERE tenant_id = 'default' AND COALESCE(setup_complete, 0) = 1
  )
  AND (
    company_legal_name IS NULL
    OR TRIM(COALESCE(company_legal_name, '')) = ''
    OR company_legal_name = (
      SELECT company_legal_name FROM tenant_settings WHERE id = 'default'
    )
  );

INSERT OR IGNORE INTO kv_store (key, value_json)
SELECT 'setup_step2_complete:si', value_json
FROM kv_store
WHERE key IN ('setup_step2_complete', 'setup_step2_complete:default')
  AND EXISTS (
    SELECT 1 FROM branding
    WHERE tenant_id = 'default' AND COALESCE(setup_complete, 0) = 1
  );

-- Always reopen the wizard on default when it was marked complete
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
  AND COALESCE(setup_complete, 0) = 1;

UPDATE tenant_settings
SET
  platform_name = 'BlokHR',
  company_legal_name = NULL,
  logo_data_url = NULL,
  login_tagline = NULL,
  settings_json = '{}',
  updated_at = datetime('now')
WHERE id = 'default'
  AND EXISTS (
    SELECT 1 FROM branding
    WHERE tenant_id = 'default'
      AND COALESCE(setup_complete, 0) = 0
      AND TRIM(COALESCE(company_name, '')) = ''
  );

DELETE FROM kv_store
WHERE key IN ('setup_step2_complete', 'setup_step2_complete:default');
