import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolTimetableApp,
  createStubIdentityClient,
  type SchoolTimetableSqlite,
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

describe('school-timetable guardian schedule scope', () => {
  let app: Express;
  let db: SchoolTimetableSqlite;

  beforeEach(async () => {
    const created = await createSchoolTimetableApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
      identityClient: createStubIdentityClient({
        s1: { sectionRef: '8|A', academicSessionId: 'sess-1' },
      }),
    });
    app = created.app;
    db = created.db;

    const scheme = await request(app)
      .post('/api/timetable/t1/day-schemes')
      .set(staff('school_admin'))
      .send({
        label: 'Weekly',
        kind: 'weekly',
        periods: [
          {
            index: 0,
            label: 'P1',
            start_time: '09:00',
            end_time: '09:45',
            is_teaching: 1,
          },
        ],
      });
    await request(app)
      .post('/api/timetable/t1/sections')
      .set(staff('school_admin'))
      .send({
        academic_session_id: 'sess-1',
        class_label: '8',
        section: 'A',
        day_scheme_id: scheme.body.id,
      });
  });

  afterEach(async () => {
    await db.close();
  });

  it('denies unlinked student and allows linked with section_ref', async () => {
    const unlinked = await request(app)
      .get('/api/timetable/t1/guardian/students/s9/schedule')
      .set(guardian('g1', ['s1']));
    expect(unlinked.status).toBe(403);

    const noSecret = await request(app)
      .get('/api/timetable/t1/guardian/students/s1/schedule')
      .set({
        'X-Blok-Principal': 'guardian',
        'X-Blok-Guardian': 'g1',
        'X-Blok-Students': 's1',
      });
    expect(noSecret.status).toBe(401);

    const ok = await request(app)
      .get('/api/timetable/t1/guardian/students/s1/schedule?section_ref=8%7CA')
      .set(guardian('g1', ['s1']));
    expect(ok.status).toBe(200);
    expect(ok.body.section_ref).toBe('8|A');
    expect(Array.isArray(ok.body.slots)).toBe(true);
  });
});
