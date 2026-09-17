import { AsyncLocalStorage } from 'node:async_hooks';
import type { SchoolEngagementDb } from './db';

export const engagementDbAls = new AsyncLocalStorage<SchoolEngagementDb>();

export function currentEngagementDb(fallback: SchoolEngagementDb): SchoolEngagementDb {
  return engagementDbAls.getStore() ?? fallback;
}
