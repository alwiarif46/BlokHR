import { AsyncLocalStorage } from 'node:async_hooks';
import type { SchoolAssessmentDb } from './db';

export const assessmentDbAls = new AsyncLocalStorage<SchoolAssessmentDb>();

export function currentAssessmentDb(fallback: SchoolAssessmentDb): SchoolAssessmentDb {
  return assessmentDbAls.getStore() ?? fallback;
}
