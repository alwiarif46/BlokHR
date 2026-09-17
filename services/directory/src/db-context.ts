import { AsyncLocalStorage } from 'node:async_hooks';
import type { DirectorySqlite } from './db';

/** Request-scoped directory DB when TENANT_DB_SPLIT is on. */
export const directoryDbAls = new AsyncLocalStorage<DirectorySqlite>();

export function currentDirectoryDb(fallback: DirectorySqlite): DirectorySqlite {
  return directoryDbAls.getStore() ?? fallback;
}
