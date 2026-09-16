import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolFeesApp,
  type SchoolFeesSqlite,
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

describe('school-fees guardian ledger scope', () => {
  let app: Express;
  let db: SchoolFeesSqlite;

  beforeEach(async () => {
    const created = await createSchoolFeesApp({
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

  it('allows linked student ledger and denies unlinked / no secret', async () => {
    const ok = await request(app)
      .get('/api/fees/t1/guardian/students/s1/ledger')
      .set(guardian('g1', ['s1']));
    expect(ok.status).toBe(200);
    expect(ok.body.entries).toEqual([]);

    const unlinked = await request(app)
      .get('/api/fees/t1/guardian/students/s9/ledger')
      .set(guardian('g1', ['s1']));
    expect(unlinked.status).toBe(403);

    const noSecret = await request(app)
      .get('/api/fees/t1/guardian/students/s1/ledger')
      .set({
        'X-Blok-Principal': 'guardian',
        'X-Blok-Guardian': 'g1',
        'X-Blok-Students': 's1',
      });
    expect(noSecret.status).toBe(401);

    const staffOk = await request(app)
      .get('/api/fees/t1/students/s1/ledger')
      .set(staff('office'));
    expect(staffOk.status).toBe(200);
  });
});
