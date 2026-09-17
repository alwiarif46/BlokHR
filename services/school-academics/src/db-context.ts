import { AsyncLocalStorage } from 'node:async_hooks';
import type { SchoolAcademicsDb } from './db';

export const academicsDbAls = new AsyncLocalStorage<SchoolAcademicsDb>();

export function currentAcademicsDb(fallback: SchoolAcademicsDb): SchoolAcademicsDb {
  return academicsDbAls.getStore() ?? fallback;
}
