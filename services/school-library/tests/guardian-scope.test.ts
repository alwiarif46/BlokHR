import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolLibraryApp,
  type SchoolLibrarySqlite,
} from '../src/index';
import { staff, SECRET } from './helpers/auth';

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

describe('school-library guardian library-summary scope', () => {
  let app: Express;
  let db: SchoolLibrarySqlite;

  beforeEach(async () => {
    const created = await createSchoolLibraryApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('allows linked student summary and denies unlinked / no secret', async () => {
    const ok = await request(app)
      .get('/api/library/t1/guardian/students/s1/library-summary')
      .set(guardian('g1', ['s1']));
    expect(ok.status).toBe(200);
    expect(ok.body.open_loans).toBe(0);

    const unlinked = await request(app)
      .get('/api/library/t1/guardian/students/s9/library-summary')
      .set(guardian('g1', ['s1']));
    expect(unlinked.status).toBe(403);

    const noSecret = await request(app)
      .get('/api/library/t1/guardian/students/s1/library-summary')
      .set({
        'X-Blok-Principal': 'guardian',
        'X-Blok-Guardian': 'g1',
        'X-Blok-Students': 's1',
      });
    expect(noSecret.status).toBe(401);

    const staffOk = await request(app)
      .get('/api/library/t1/students/s1/library-summary')
      .set(staff('office'));
    expect(staffOk.status).toBe(200);
  });
});
