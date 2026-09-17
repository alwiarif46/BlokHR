import { AsyncLocalStorage } from 'node:async_hooks';
import type { SchoolIdentityDb } from './db';

export const identityDbAls = new AsyncLocalStorage<SchoolIdentityDb>();

export function currentIdentityDb(fallback: SchoolIdentityDb): SchoolIdentityDb {
  return identityDbAls.getStore() ?? fallback;
}
