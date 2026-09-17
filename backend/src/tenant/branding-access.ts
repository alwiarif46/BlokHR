/**
 * Tenant-scoped branding helpers. Replaces singleton `WHERE id = 1`.
 */
import type { DatabaseEngine } from '../db/engine';
import { getTenantId } from './context';

export async function getBrandingForTenant<T extends Record<string, unknown>>(
  db: DatabaseEngine,
  tenantId?: string,
): Promise<T | undefined> {
  const tid = (tenantId || getTenantId()).trim() || 'default';
  return db.get<T>('SELECT * FROM branding WHERE tenant_id = ?', [tid]);
}

export async function ensureBrandingRow(db: DatabaseEngine, tenantId?: string): Promise<void> {
  const tid = (tenantId || getTenantId()).trim() || 'default';
  await db.run('INSERT OR IGNORE INTO branding (tenant_id) VALUES (?)', [tid]);
}
