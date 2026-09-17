import { AsyncLocalStorage } from 'node:async_hooks';
import type { SchoolAttendanceDb } from './db';

export const attendanceDbAls = new AsyncLocalStorage<SchoolAttendanceDb>();

export function currentAttendanceDb(fallback: SchoolAttendanceDb): SchoolAttendanceDb {
  return attendanceDbAls.getStore() ?? fallback;
}
