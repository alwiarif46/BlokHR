import { AsyncLocalStorage } from 'node:async_hooks';
import type { SchoolComplianceDb } from './db';

export const complianceDbAls = new AsyncLocalStorage<SchoolComplianceDb>();

export function currentComplianceDb(fallback: SchoolComplianceDb): SchoolComplianceDb {
  return complianceDbAls.getStore() ?? fallback;
}
