import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolAcademicsApp,
  createStubIdentityClient,
  type SchoolAcademicsSqlite,
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

describe('school-academics guardian assignments scope', () => {
  let app: Express;
  let db: SchoolAcademicsSqlite;

  beforeEach(async () => {
    const created = await createSchoolAcademicsApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
      identityClient: createStubIdentityClient({
        s1: { sectionRef: '5|A', academicSessionId: '2025-26' },
      }),
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('allows linked student and denies unlinked', async () => {
    const ok = await request(app)
      .get('/api/academics/t1/guardian/students/s1/assignments')
      .set(guardian('g1', ['s1']));
    expect(ok.status).toBe(200);
    expect(ok.body.assignments).toEqual([]);
    expect(ok.body.section_ref).toBe('5|A');

    const unlinked = await request(app)
      .get('/api/academics/t1/guardian/students/s9/assignments')
      .set(guardian('g1', ['s1']));
    expect(unlinked.status).toBe(403);
  });
});
