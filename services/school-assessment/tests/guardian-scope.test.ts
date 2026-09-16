import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolAssessmentApp,
  type SchoolAssessmentSqlite,
} from '../src/index';
import { SECRET } from './helpers/auth';

function guardian(guardianId: string, studentRefs: string[] = []) {
  const h: Record<string, string> = {
    'X-Blok-Internal': SECRET,
    'X-Blok-Principal': 'guardian',
    'X-Blok-Guardian': guardianId,
  };
  if (studentRefs.length) {
    h['X-Blok-Students'] = studentRefs.join(',');
  }
  return h;
}

describe('school-assessment guardian report-cards scope', () => {
  let app: Express;
  let db: SchoolAssessmentSqlite;

  beforeEach(async () => {
    const created = await createSchoolAssessmentApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('allows linked student and denies unlinked', async () => {
    const ok = await request(app)
      .get('/api/assessment/t1/guardian/students/s1/report-cards')
      .set(guardian('g1', ['s1']));
    expect(ok.status).toBe(200);
    expect(ok.body.cards).toEqual([]);
    expect(ok.body.marks).toEqual([]);

    const unlinked = await request(app)
      .get('/api/assessment/t1/guardian/students/s9/report-cards')
      .set(guardian('g1', ['s1']));
    expect(unlinked.status).toBe(403);

    const noSecret = await request(app)
      .get('/api/assessment/t1/guardian/students/s1/report-cards')
      .set({
        'X-Blok-Principal': 'guardian',
        'X-Blok-Guardian': 'g1',
        'X-Blok-Students': 's1',
      });
    expect(noSecret.status).toBe(401);
  });
});
