import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolAttendanceApp } from '../src/index';
import type { SchoolAttendanceSqlite } from '../src/db';
import { StubTimetableClient } from '../src/clients/timetable-client';
import { staff } from './helpers/auth';

describe('school-attendance L5 teacher scope (P12-05)', () => {
  let app: Express;
  let db: SchoolAttendanceSqlite;
  let timetable: StubTimetableClient;

  beforeEach(async () => {
    timetable = new StubTimetableClient();
    const created = await createSchoolAttendanceApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      timetableClient: timetable,
    });
    app = created.app;
    db = created.db;

    await request(app)
      .put('/api/attendance/t1/settings')
      .set(staff('school_admin'))
      .send({ granularity: 'period', edit_window_minutes: 1440 });
  });

  afterEach(async () => {
    await db.close();
  });

  it('teacher allowed / denied / unverifiable on /mark; admin bypasses client', async () => {
    timetable.allowed = true;
    const ok = await request(app)
      .post('/api/attendance/t1/mark')
      .set(staff('teacher', 'm1'))
      .send({
        context: { date: '2025-09-10', period_instance_id: 'pi-own' },
        marked_by: 'm1',
        idempotency_key: 'k1',
        marks: [{ student_id: 's1', status: 'present' }],
      });
    expect(ok.status).toBe(200);
    expect(timetable.calls).toHaveLength(1);
    expect(timetable.calls[0].periodInstanceId).toBe('pi-own');

    timetable.allowed = false;
    const denied = await request(app)
      .post('/api/attendance/t1/mark')
      .set(staff('teacher', 'm1'))
      .send({
        context: { date: '2025-09-10', period_instance_id: 'pi-other' },
        marked_by: 'm1',
        idempotency_key: 'k2',
        marks: [{ student_id: 's1', status: 'present' }],
      });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe('scope_denied');

    timetable.unverifiable = true;
    const down = await request(app)
      .post('/api/attendance/t1/mark')
      .set(staff('teacher', 'm1'))
      .send({
        context: { date: '2025-09-10', period_instance_id: 'pi-x' },
        marked_by: 'm1',
        idempotency_key: 'k3',
        marks: [{ student_id: 's1', status: 'present' }],
      });
    expect(down.status).toBe(403);
    expect(down.body.error).toBe('scope_unverifiable');

    const before = timetable.calls.length;
    timetable.unverifiable = false;
    timetable.allowed = false;
    const admin = await request(app)
      .post('/api/attendance/t1/mark')
      .set(staff('school_admin'))
      .send({
        context: { date: '2025-09-10', period_instance_id: 'pi-any' },
        marked_by: 'admin',
        idempotency_key: 'k4',
        marks: [{ student_id: 's2', status: 'present' }],
      });
    expect(admin.status).toBe(200);
    expect(timetable.calls.length).toBe(before);
  });

  it('PATCH record uses stored period_instance_id not body', async () => {
    timetable.allowed = true;
    const created = await request(app)
      .post('/api/attendance/t1/mark')
      .set(staff('teacher', 'm1'))
      .send({
        context: { date: '2025-09-11', period_instance_id: 'pi-stored' },
        marked_by: 'm1',
        idempotency_key: 'k-patch',
        marks: [{ student_id: 's1', status: 'present' }],
      });
    const id = created.body.records[0].id as string;
    timetable.calls = [];
    timetable.allowed = true;

    const patched = await request(app)
      .patch(`/api/attendance/t1/records/${id}`)
      .set(staff('teacher', 'm1'))
      .send({
        status: 'absent',
        period_instance_id: 'pi-forged',
        actor: 'm1',
      });
    expect(patched.status).toBe(200);
    expect(timetable.calls).toHaveLength(1);
    expect(timetable.calls[0].periodInstanceId).toBe('pi-stored');
  });
});
