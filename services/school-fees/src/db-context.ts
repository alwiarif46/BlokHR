import { AsyncLocalStorage } from 'node:async_hooks';
import type { SchoolFeesDb } from './db';

export const feesDbAls = new AsyncLocalStorage<SchoolFeesDb>();

export function currentFeesDb(fallback: SchoolFeesDb): SchoolFeesDb {
  return feesDbAls.getStore() ?? fallback;
}
