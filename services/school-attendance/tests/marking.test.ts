import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolAttendanceApp,
  type DomainEvent,
  type EventPublisher,
} from '../src/index';
import { staff, guardian, internalOnly, SECRET } from './helpers/auth';
import type { SchoolAttendanceSqlite } from '../src/db';

class RecordingPublisher implements EventPublisher {
  events: DomainEvent[] = [];
  async publish(e: DomainEvent): Promise<void> {
    this.events.push(e);
  }
}

describe('school-attendance marking', () => {
  let app: Express;
  let db: SchoolAttendanceSqlite;
  let publisher: RecordingPublisher;

  beforeEach(async () => {
    publisher = new RecordingPublisher();
    const created = await createSchoolAttendanceApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      eventPublisher: publisher,
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  async function sickCode(tenant = 't1') {
    const codes = await request(app).get(`/api/attendance/${tenant}/reason-codes`).set(staff('school_admin'));
    return codes.body.reasonCodes.find((c: { code: string }) => c.code === 'SICK').id as string;
  }

  async function countRecords(tenant: string) {
    const row = await db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM attendance_records WHERE tenant_id = ?',
      [tenant],
    );
    return Number(row?.c ?? 0);
  }

  async function countAudits(tenant: string, recordId: string) {
    const row = await db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM attendance_audit WHERE tenant_id = ? AND record_id = ?',
      [tenant, recordId],
    );
    return Number(row?.c ?? 0);
  }

  it('marks day and period granularity; rejects wrong context', async () => {
    const day = await request(app).post('/api/attendance/t1/mark').set(staff('school_admin')).send({
      context: { date: '2025-08-11' },
      marks: [{ student_id: 's1', status: 'present' }],
      marked_by: 'teacher-1',
      idempotency_key: 'day-1',
    });
    expect(day.status).toBe(200);
    expect(day.body.records).toHaveLength(1);
    expect(day.body.records[0].status).toBe('present');

    await request(app).put('/api/attendance/t1/settings').set(staff('school_admin')).send({ granularity: 'period' });
    const wrong = await request(app).post('/api/attendance/t1/mark').set(staff('school_admin')).send({
      context: { date: '2025-08-11' },
      marks: [{ student_id: 's1', status: 'present' }],
      marked_by: 'teacher-1',
      idempotency_key: 'period-bad',
    });
    expect(wrong.status).toBe(400);

    const period = await request(app).post('/api/attendance/t1/mark').set(staff('school_admin')).send({
      context: { date: '2025-08-11', period_instance_id: 'pi-1' },
      marks: [{ student_id: 's1', status: 'absent', reason_code_id: await sickCode() }],
      marked_by: 'teacher-1',
      idempotency_key: 'period-1',
    });
    expect(period.status).toBe(200);
    expect(period.body.records[0].periodInstanceId).toBe('pi-1');
  });

  it('replays idempotent mark with zero new writes', async () => {
    const first = await request(app).post('/api/attendance/t1/mark').set(staff('school_admin')).send({
      context: { date: '2025-08-11' },
      marks: [
        { student_id: 's1', status: 'present' },
        { student_id: 's2', status: 'absent', reason_code_id: await sickCode() },
      ],
      marked_by: 'teacher-1',
      idempotency_key: 'batch-A',
    });
    expect(first.status).toBe(200);
    expect(first.body.replayed).toBe(false);
    const countAfterFirst = await countRecords('t1');

    const second = await request(app).post('/api/attendance/t1/mark').set(staff('school_admin')).send({
      context: { date: '2025-08-11' },
      marks: [
        { student_id: 's1', status: 'present' },
        { student_id: 's2', status: 'absent', reason_code_id: await sickCode() },
      ],
      marked_by: 'teacher-1',
      idempotency_key: 'batch-A',
    });
    expect(second.status).toBe(200);
    expect(second.body.replayed).toBe(true);
    expect(second.body.records).toHaveLength(2);
    expect(await countRecords('t1')).toBe(countAfterFirst);
  });

  it('requires late_minutes and emits absent events', async () => {
    const noLate = await request(app).post('/api/attendance/t1/mark').set(staff('school_admin')).send({
      context: { date: '2025-08-11' },
      marks: [{ student_id: 's1', status: 'late' }],
      marked_by: 't',
      idempotency_key: 'late-bad',
    });
    expect(noLate.status).toBe(400);

    const late = await request(app).post('/api/attendance/t1/mark').set(staff('school_admin')).send({
      context: { date: '2025-08-11' },
      marks: [{ student_id: 's1', status: 'late', late_minutes: 45 }],
      marked_by: 't',
      idempotency_key: 'late-ok',
    });
    expect(late.status).toBe(200);
    expect(late.body.records[0].status).toBe('late');
    expect(late.body.records[0].lateMinutes).toBe(45);

    publisher.events = [];
    await request(app).post('/api/attendance/t1/mark').set(staff('school_admin')).send({
      context: { date: '2025-08-12' },
      marks: [
        { student_id: 's1', status: 'absent', reason_code_id: await sickCode() },
        { student_id: 's2', status: 'absent' },
      ],
      marked_by: 't',
      idempotency_key: 'abs-1',
    });
    const absentEvents = publisher.events.filter(
      (e) => e.type === 'school.attendance.marked_absent',
    );
    expect(absentEvents).toHaveLength(2);
    expect(absentEvents[0].data.reason_bucket).toBe('medical');
  });

  it('enforces edit window, audit, and regularization', async () => {
    await request(app).put('/api/attendance/t1/settings').set(staff('school_admin')).send({
      edit_window_minutes: 120,
    });
    const marked = await request(app).post('/api/attendance/t1/mark').set(staff('school_admin')).send({
      context: { date: '2025-08-11' },
      marks: [{ student_id: 's1', status: 'present' }],
      marked_by: 't',
      idempotency_key: 'edit-1',
    });
    const id = marked.body.records[0].id as string;

    const patched = await request(app)
      .patch(`/api/attendance/t1/records/${id}`).set(staff('school_admin'))
      .send({ status: 'absent', actor: 't', reason_code_id: await sickCode() });
    expect(patched.status).toBe(200);
    expect(patched.body.status).toBe('absent');

    const audits = await countAudits('t1', id);
    expect(audits).toBeGreaterThanOrEqual(1);

    await request(app).put('/api/attendance/t1/settings').set(staff('school_admin')).send({
      edit_window_minutes: 0,
    });
    // Force marked_at into the past so window is closed
    await db.run(
      `UPDATE attendance_records SET marked_at = '2020-01-01T00:00:00.000Z' WHERE id = ?`,
      [id],
    );

    const closed = await request(app)
      .patch(`/api/attendance/t1/records/${id}`).set(staff('school_admin'))
      .send({ status: 'present', actor: 't' });
    expect(closed.status).toBe(409);
    expect(closed.body.error).toBe('window_closed');
    expect(closed.body.regularization_required).toBe(true);

    publisher.events = [];
    const reg = await request(app)
      .post(`/api/attendance/t1/records/${id}/regularize`).set(staff('school_admin'))
      .send({
        new_status: 'present',
        new_excuse: 'excused',
        reason_code_id: await sickCode(),
        approved_by: 'admin-1',
        note: 'doctor note',
      });
    expect(reg.status).toBe(200);
    expect(reg.body.source).toBe('regularization');
    expect(publisher.events.some((e) => e.type === 'school.attendance.regularized')).toBe(
      true,
    );
  });

  it('returns register with unmarked and isolates tenants', async () => {
    await request(app).post('/api/attendance/t1/mark').set(staff('school_admin')).send({
      context: { date: '2025-08-11' },
      marks: [{ student_id: 's1', status: 'present' }],
      marked_by: 't',
      idempotency_key: 'reg-1',
    });

    const reg = await request(app).get(
      '/api/attendance/t1/register?date=2025-08-11&section=8A&student_ids=s1,s2'
    ).set(staff('school_admin'));
    expect(reg.status).toBe(200);
    expect(reg.body.register.s1.status).toBe('present');
    expect(reg.body.register.s2).toEqual({ status: 'unmarked' });

    const other = await request(app).get(
      '/api/attendance/tenant-b/register?date=2025-08-11&student_ids=s1'
    ).set(staff('school_admin'));
    expect(other.body.register.s1).toEqual({ status: 'unmarked' });
  });
});
