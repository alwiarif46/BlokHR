-- 057_members_tenant_from_admins: refine member tenant_id using admins table.
-- Migration 056 assigned every member to one bucket (si or default). Admins are
-- already per-tenant after 055 — use that as the source of truth for owners,
-- then leave remaining members on their 056 tenant.

UPDATE members
SET tenant_id = (
  SELECT a.tenant_id FROM admins a
  WHERE lower(a.email) = lower(members.email)
  ORDER BY CASE WHEN a.tenant_id = 'si' THEN 0 ELSE 1 END
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM admins a WHERE lower(a.email) = lower(members.email)
);
