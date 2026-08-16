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

describe('school-attendance staff leave (P2-09)', () => {
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

  async function seedClType(): Promise<string> {
    const types = await request(app).get('/api/attendance/t1/staff/leave/types').set(staff('school_admin'));
    expect(types.status).toBe(200);
    const cl = (types.body.types as Array<{ id: string; code: string }>).find(
      (t) => t.code === 'CL',
    );
    expect(cl).toBeTruthy();
    return cl!.id;
  }

  it('seeds CL/EL/ML on first read', async () => {
    const res = await request(app).get('/api/attendance/t1/staff/leave/types').set(staff('school_admin'));
    expect(res.status).toBe(200);
    const codes = (res.body.types as Array<{ code: string; annualQuota: number }>).map(
      (t) => t.code,
    );
    expect(codes).toEqual(['CL', 'EL', 'ML']);
    const cl = (res.body.types as Array<{ code: string; annualQuota: number }>).find(
      (t) => t.code === 'CL',
    );
    expect(cl?.annualQuota).toBe(12);
  });

  it('half-day maths and overlap 409', async () => {
    const typeId = await seedClType();
    const half = await request(app).post('/api/attendance/t1/staff/leave/requests').set(staff('school_admin')).send({
      member_id: 'm1',
      leave_type_id: typeId,
      from_date: '2025-09-01',
      to_date: '2025-09-01',
      is_half_day: true,
      reason: 'half',
    });
    expect(half.status).toBe(201);
    expect(half.body.days).toBe(0.5);

    const overlap = await request(app).post('/api/attendance/t1/staff/leave/requests').set(staff('school_admin')).send({
      member_id: 'm1',
      leave_type_id: typeId,
      from_date: '2025-09-01',
      to_date: '2025-09-02',
    });
    expect(overlap.status).toBe(409);
    expect(overlap.body.error).toBe('overlapping_request');
  });

  it('approve writes on_leave rows and increments balance; reject requires note', async () => {
    const typeId = await seedClType();
    const created = await request(app).post('/api/attendance/t1/staff/leave/requests').set(staff('school_admin')).send({
      member_id: 'm1',
      leave_type_id: typeId,
      from_date: '2025-09-10',
      to_date: '2025-09-11',
      reason: 'family',
    });
    expect(created.status).toBe(201);
    expect(created.body.days).toBe(2);

    const rejectNoNote = await request(app)
      .post(`/api/attendance/t1/staff/leave/requests/${created.body.id}/decide`).set(staff('school_admin'))
      .send({ decision: 'rejected', decided_by: 'admin' });
    expect(rejectNoNote.status).toBe(400);

    const approved = await request(app)
      .post(`/api/attendance/t1/staff/leave/requests/${created.body.id}/decide`).set(staff('school_admin'))
      .send({ decision: 'approved', decided_by: 'admin-1' });
    expect(approved.status).toBe(200);
    expect(approved.body.state).toBe('approved');
    expect(approved.body.skipped_locked).toEqual([]);
    expect(
      publisher.events.some((e) => e.type === 'school.staff.leave_approved'),
    ).toBe(true);

    const grid = await request(app).get('/api/attendance/t1/staff?month=2025-09&member_id=m1').set(staff('school_admin'));
    expect(grid.status).toBe(200);
    const dates = (grid.body.records as Array<{ date: string; status: string }>).map(
      (r) => r.date,
    );
    expect(dates).toContain('2025-09-10');
    expect(dates).toContain('2025-09-11');
    expect(
      (grid.body.records as Array<{ status: string }>).every((r) => r.status === 'on_leave'),
    ).toBe(true);

    const bal = await request(app).get(
      '/api/attendance/t1/staff/leave/balances?member_id=m1&year=2025'
    ).set(staff('school_admin'));
    expect(bal.status).toBe(200);
    const clBal = (
      bal.body.balances as Array<{ leave_type_id: string; used: number; remaining: number }>
    ).find((b) => b.leave_type_id === typeId);
    expect(clBal?.used).toBe(2);
    expect(clBal?.remaining).toBe(10);
  });

  it('insufficient balance returns remaining', async () => {
    const typeId = await seedClType();
    await request(app)
      .patch(`/api/attendance/t1/staff/leave/types/${typeId}`).set(staff('school_admin'))
      .send({ annual_quota: 1 });

    const created = await request(app).post('/api/attendance/t1/staff/leave/requests').set(staff('school_admin')).send({
      member_id: 'm2',
      leave_type_id: typeId,
      from_date: '2025-10-01',
      to_date: '2025-10-03',
    });
    expect(created.body.days).toBe(3);

    // Force balance opening to 1 for this member by creating after quota patch —
    // ensureLeaveBalance uses current annual_quota when creating the row.
    const decide = await request(app)
      .post(`/api/attendance/t1/staff/leave/requests/${created.body.id}/decide`).set(staff('school_admin'))
      .send({ decision: 'approved', decided_by: 'admin' });
    expect(decide.status).toBe(400);
    expect(decide.body.error).toBe('insufficient_balance');
    expect(decide.body.remaining).toBe(1);
  });

  it('finalized-month skip on approve and 409 on cancel into locked month', async () => {
    const typeId = await seedClType();
    await request(app).post('/api/attendance/t1/staff/finalize').set(staff('school_admin')).send({
      month: '2025-11',
      finalized_by: 'payroll',
    });

    const created = await request(app).post('/api/attendance/t1/staff/leave/requests').set(staff('school_admin')).send({
      member_id: 'm3',
      leave_type_id: typeId,
      from_date: '2025-11-28',
      to_date: '2025-12-02',
    });
    const approved = await request(app)
      .post(`/api/attendance/t1/staff/leave/requests/${created.body.id}/decide`).set(staff('school_admin'))
      .send({ decision: 'approved', decided_by: 'admin' });
    expect(approved.status).toBe(200);
    expect(approved.body.skipped_locked).toEqual([
      '2025-11-28',
      '2025-11-29',
      '2025-11-30',
    ]);

    const nov = await request(app).get('/api/attendance/t1/staff?month=2025-11&member_id=m3').set(staff('school_admin'));
    expect(nov.body.records.length).toBe(0);
    const dec = await request(app).get('/api/attendance/t1/staff?month=2025-12&member_id=m3').set(staff('school_admin'));
    expect(dec.body.records.length).toBe(2);

    const cancelLocked = await request(app)
      .post(`/api/attendance/t1/staff/leave/requests/${created.body.id}/cancel`).set(staff('school_admin'))
      .send({ actor: 'admin' });
    expect(cancelLocked.status).toBe(409);
  });

  it('approved-cancel restores balance and keeps overwritten rows', async () => {
    const typeId = await seedClType();
    const created = await request(app).post('/api/attendance/t1/staff/leave/requests').set(staff('school_admin')).send({
      member_id: 'm4',
      leave_type_id: typeId,
      from_date: '2025-08-20',
      to_date: '2025-08-21',
    });
    await request(app)
      .post(`/api/attendance/t1/staff/leave/requests/${created.body.id}/decide`).set(staff('school_admin'))
      .send({ decision: 'approved', decided_by: 'admin' });

    // Overwrite one leave day (check-in preserves on_leave status; mark replaces it)
    await request(app).post('/api/attendance/t1/staff/mark').set(staff('school_admin')).send({
      date: '2025-08-20',
      marked_by: 'admin',
      marks: [{ member_id: 'm4', status: 'present' }],
    });

    const cancelled = await request(app)
      .post(`/api/attendance/t1/staff/leave/requests/${created.body.id}/cancel`).set(staff('school_admin'))
      .send({ actor: 'admin' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.state).toBe('cancelled');
    expect(cancelled.body.kept).toEqual(['2025-08-20']);
    expect(
      publisher.events.some((e) => e.type === 'school.staff.leave_cancelled'),
    ).toBe(true);

    const grid = await request(app).get('/api/attendance/t1/staff?month=2025-08&member_id=m4').set(staff('school_admin'));
    const byDate = Object.fromEntries(
      (grid.body.records as Array<{ date: string; status: string }>).map((r) => [
        r.date,
        r.status,
      ]),
    );
    expect(byDate['2025-08-20']).toBe('present');
    expect(byDate['2025-08-21']).toBeUndefined();

    const bal = await request(app).get(
      '/api/attendance/t1/staff/leave/balances?member_id=m4&year=2025'
    ).set(staff('school_admin'));
    const clBal = (
      bal.body.balances as Array<{ leave_type_id: string; used: number }>
    ).find((b) => b.leave_type_id === typeId);
    expect(clBal?.used).toBe(0);
  });

  it('tenant isolation for leave requests', async () => {
    const t1Types = await request(app).get('/api/attendance/t1/staff/leave/types').set(staff('school_admin'));
    const t2Types = await request(app).get('/api/attendance/t2/staff/leave/types').set(staff('school_admin'));
    const t1Cl = (t1Types.body.types as Array<{ id: string; code: string }>).find(
      (t) => t.code === 'CL',
    )!;
    const t2Cl = (t2Types.body.types as Array<{ id: string; code: string }>).find(
      (t) => t.code === 'CL',
    )!;
    expect(t1Cl.id).not.toBe(t2Cl.id);

    const r1 = await request(app).post('/api/attendance/t1/staff/leave/requests').set(staff('school_admin')).send({
      member_id: 'shared',
      leave_type_id: t1Cl.id,
      from_date: '2025-07-01',
      to_date: '2025-07-01',
    });
    await request(app).post('/api/attendance/t2/staff/leave/requests').set(staff('school_admin')).send({
      member_id: 'shared',
      leave_type_id: t2Cl.id,
      from_date: '2025-07-01',
      to_date: '2025-07-01',
    });

    const list1 = await request(app).get(
      '/api/attendance/t1/staff/leave/requests?member_id=shared'
    ).set(staff('school_admin'));
    const list2 = await request(app).get(
      '/api/attendance/t2/staff/leave/requests?member_id=shared'
    ).set(staff('school_admin'));
    expect(list1.body.requests).toHaveLength(1);
    expect(list2.body.requests).toHaveLength(1);
    expect(list1.body.requests[0].id).toBe(r1.body.id);
    expect(list2.body.requests[0].id).not.toBe(r1.body.id);
  });
});
