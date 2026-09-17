import { AsyncLocalStorage } from 'node:async_hooks';
import type { SchoolTimetableDb } from './db';

export const timetableDbAls = new AsyncLocalStorage<SchoolTimetableDb>();

export function currentTimetableDb(fallback: SchoolTimetableDb): SchoolTimetableDb {
  return timetableDbAls.getStore() ?? fallback;
}
