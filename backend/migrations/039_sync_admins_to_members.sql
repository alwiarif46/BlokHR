-- Migration 039: Sync admins → members
-- Ensures every admin email in the admins table also has a row in members.
-- For new tenants, setup-service.ts now handles this at wizard time.
-- This migration catches existing tenants where setup already completed.
-- Reads primary_timezone from tenant_settings — never hardcoded.

INSERT OR IGNORE INTO members (id, email, name, role, active, timezone)
SELECT
  a.email,
  a.email,
  REPLACE(REPLACE(REPLACE(SUBSTR(a.email, 1, INSTR(a.email, '@') - 1), '.', ' '), '_', ' '), '-', ' '),
  'admin',
  1,
  COALESCE(
    (SELECT primary_timezone FROM tenant_settings LIMIT 1),
    'UTC'
  )
FROM admins a
WHERE a.email NOT IN (SELECT email FROM members);
