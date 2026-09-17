/**
 * Tenant-scoped admin helpers. Replaces email-only `admins` lookups.
 */
import type { DatabaseEngine } from '../db/engine';
import { getTenantId } from './context';

export async function isTenantAdmin(
  db: DatabaseEngine,
  email: string,
  tenantId?: string,
): Promise<boolean> {
  const tid = (tenantId || getTenantId()).trim() || 'default';
  const normalized = String(email || '')
    .toLowerCase()
    .trim();
  if (!normalized) return false;
  const row = await db.get<{ email: string }>(
    'SELECT email FROM admins WHERE tenant_id = ? AND email = ?',
    [tid, normalized],
  );
  return !!row;
}

export async function listTenantAdmins(
  db: DatabaseEngine,
  tenantId?: string,
): Promise<string[]> {
  const tid = (tenantId || getTenantId()).trim() || 'default';
  const rows = await db.all<{ email: string }>(
    'SELECT email FROM admins WHERE tenant_id = ? ORDER BY email',
    [tid],
  );
  return rows.map((r) => r.email);
}

export async function insertTenantAdmin(
  db: DatabaseEngine,
  email: string,
  tenantId?: string,
): Promise<void> {
  const tid = (tenantId || getTenantId()).trim() || 'default';
  const normalized = String(email || '')
    .toLowerCase()
    .trim();
  if (!normalized) return;
  await db.run('INSERT OR IGNORE INTO admins (tenant_id, email) VALUES (?, ?)', [
    tid,
    normalized,
  ]);
}

export async function deleteTenantAdmin(
  db: DatabaseEngine,
  email: string,
  tenantId?: string,
): Promise<void> {
  const tid = (tenantId || getTenantId()).trim() || 'default';
  const normalized = String(email || '')
    .toLowerCase()
    .trim();
  if (!normalized) return;
  await db.run('DELETE FROM admins WHERE tenant_id = ? AND email = ?', [tid, normalized]);
}
