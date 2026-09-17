-- 063_wipe_all_tenants.sql
-- Marks a pending full tenant wipe. Application code in wipe-tenant-org-data.ts
-- empties org tables and resets branding to empty `default` (wizard open).
-- Idempotent via kv key full_tenant_wipe_v1 after the wipe runs.

INSERT OR REPLACE INTO kv_store (key, value_json) VALUES ('pending_full_tenant_wipe', '"1"');
