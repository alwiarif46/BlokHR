/**
 * Request-scoped tenant context (AsyncLocalStorage).
 * Middleware must call runWithTenant so getTenantId() works in services.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

type TenantStore = { tenantId: string };

const storage = new AsyncLocalStorage<TenantStore>();

export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return storage.run({ tenantId }, fn);
}

export function getTenantId(fallback = 'default'): string {
  return storage.getStore()?.tenantId ?? fallback;
}
