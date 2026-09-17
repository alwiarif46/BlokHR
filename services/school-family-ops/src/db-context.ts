import { AsyncLocalStorage } from 'node:async_hooks';
import type { SchoolFamilyOpsDb } from './db';

export const familyOpsDbAls = new AsyncLocalStorage<SchoolFamilyOpsDb>();

export function currentFamilyOpsDb(fallback: SchoolFamilyOpsDb): SchoolFamilyOpsDb {
  return familyOpsDbAls.getStore() ?? fallback;
}
