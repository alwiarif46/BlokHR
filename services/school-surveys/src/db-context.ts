import { AsyncLocalStorage } from 'node:async_hooks';
import type { SchoolSurveysDb } from './db';

export const surveysDbAls = new AsyncLocalStorage<SchoolSurveysDb>();

export function currentSurveysDb(fallback: SchoolSurveysDb): SchoolSurveysDb {
  return surveysDbAls.getStore() ?? fallback;
}
