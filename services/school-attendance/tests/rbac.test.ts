import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolAttendanceApp,
  ATTENDANCE_ROUTE_POLICIES,
  type Role,
} from '../src/index';
import type { SchoolAttendanceSqlite } from '../src/db';
import { StubTimetableClient } from '../src/clients/timetable-client';
import { staff, guardian, internalOnly, SECRET } from './helpers/auth';

function samplePath(pattern: RegExp): string {
  return (
    '/' +
    pattern.source
      .replace(/^\^\\?\//, '')
      .replace(/\/\?\$/, '')
      .replace(/\$/, '')
      .replace(/\\\//g, '/')
      .replace(/\[\^\/\]\+/g, 't1')
      .replace(/\/\?/g, '')
  );
}

describe('school-attendance P12-03 role guard', () => {
  let app: Express;
  let db: SchoolAttendanceSqlite;

  beforeEach(async () => {
    const created = await createSchoolAttendanceApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      timetableClient: new StubTimetableClient(),
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('table-driven allow/deny from ATTENDANCE_ROUTE_POLICIES', async () => {
    const roles: Role[] = [
      'employee',
      'teacher',
      'office',
      'school_admin',
      'admin',
    ];
    for (const policy of ATTENDANCE_ROUTE_POLICIES) {
      if (policy.internalOnly) continue;
      const url = `/api/attendance${samplePath(policy.pattern)}`;
      const method = policy.method.toLowerCase() as
        | 'get'
        | 'post'
        | 'put'
        | 'patch'
        | 'delete';

      for (const role of roles) {
        const res = await request(app)[method](url).set(staff(role));
        if (policy.roles.includes(role)) {
          // L5 scope may 403 without a period_instance_id body (P12-05).
          if (policy.scope === 'teacher_section' && role === 'teacher') {
            expect(res.body?.error).not.toBe('no_policy');
            expect(res.body?.error).not.toBe('role_denied');
            continue;
          }
          expect(res.status, `${method} ${url} role=${role}`).not.toBe(403);
          expect(res.body?.error).not.toBe('no_policy');
          expect(res.body?.error).not.toBe('role_denied');
        } else if (policy.roles.length > 0) {
          expect(res.status, `${method} ${url} role=${role}`).toBe(403);
          expect(res.body.error).toBe('role_denied');
        }
      }
    }
  });

  it('deny-by-default on unregistered path', async () => {
    const res = await request(app)
      .get('/api/attendance/t1/no-such-route')
      .set(staff('admin'));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('no_policy');
  });

  it('device capture allowed with internal secret only', async () => {
    const res = await request(app)
      .post('/api/attendance/t1/capture')
      .set(internalOnly())
      .send({});
    expect(res.status).not.toBe(401);
    expect(res.body?.error).not.toBe('role_denied');
    expect(res.body?.error).not.toBe('no_policy');
  });

  it('guardian reported-absences still works', async () => {
    await request(app)
      .post('/api/attendance/t1/reason-codes')
      .set(staff('school_admin'))
      .send({ code: 'ILL', label: 'Ill', bucket: 'illness' });
    const codes = await request(app)
      .get('/api/attendance/t1/reason-codes')
      .set(staff('office'));
    const codeId = codes.body.reasonCodes[0].id as string;

    const res = await request(app)
      .post('/api/attendance/t1/reported-absences')
      .set(guardian('g1', ['s1']))
      .send({
        student_id: 's1',
        dates: ['2025-09-01'],
        reason_code_id: codeId,
        channel: 'app',
      });
    expect(res.status).not.toBe(403);
    expect(res.body?.error).not.toBe('role_denied');
  });

  it('missing secret → 401; role without principal → 403', async () => {
    const noSecret = await request(app).get('/api/attendance/t1/reason-codes');
    expect(noSecret.status).toBe(401);

    const forged = await request(app)
      .get('/api/attendance/t1/reason-codes')
      .set('X-Blok-Internal', SECRET)
      .set('X-Blok-Role', 'teacher');
    expect(forged.status).toBe(403);
  });
});
