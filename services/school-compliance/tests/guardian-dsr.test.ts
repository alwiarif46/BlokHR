import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolComplianceApp,
  type SchoolComplianceSqlite,
} from '../src/index';
import { SECRET, staff } from './helpers/auth';

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

describe('school-compliance guardian DSR', () => {
  let app: Express;
  let db: SchoolComplianceSqlite;

  beforeEach(async () => {
    const created = await createSchoolComplianceApp({
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

  it('creates and lists DSR for linked student; denies unlinked', async () => {
    const unlinked = await request(app)
      .post('/api/compliance/t1/guardian/students/s9/dsr')
      .set(guardian('g1', ['s1']))
      .send({ kind: 'access' });
    expect(unlinked.status).toBe(403);

    const created = await request(app)
      .post('/api/compliance/t1/guardian/students/s1/dsr')
      .set(guardian('g1', ['s1']))
      .send({ kind: 'access', guardian_ref: 'spoof' });
    expect(created.status).toBe(201);
    expect(created.body.guardianRef).toBe('g1');
    expect(created.body.studentRef).toBe('s1');
    expect(created.body.state).toBe('received');

    const list = await request(app)
      .get('/api/compliance/t1/guardian/students/s1/dsr')
      .set(guardian('g1', ['s1']));
    expect(list.status).toBe(200);
    expect(list.body.requests).toHaveLength(1);

    const otherGuardian = await request(app)
      .get('/api/compliance/t1/guardian/students/s1/dsr')
      .set(guardian('g-other', ['s1']));
    expect(otherGuardian.status).toBe(200);
    expect(otherGuardian.body.requests).toHaveLength(0);
  });
});
