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
import type { SchoolAttendanceSqlite } from '../src/db';

class RecordingPublisher implements EventPublisher {
  events: DomainEvent[] = [];
  async publish(e: DomainEvent): Promise<void> {
    this.events.push(e);
  }
}

describe('school-attendance staff (P2-05)', () => {
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
    await request(app)
      .put('/api/attendance/t1/settings')
      .send({ half_day_min_minutes: 180 });
  });

  afterEach(async () => {
    await db.close();
  });

  it('check in/out derives minutes and status; rejects out-before-in', async () => {
    const outFirst = await request(app).post('/api/attendance/t1/staff/check').send({
      member_id: 'm1',
      direction: 'out',
      at: '2025-08-11T17:00:00.000Z',
      source: 'nfc',
      device_id: 'gate-1',
    });
    expect(outFirst.status).toBe(400);

    const checkIn = await request(app).post('/api/attendance/t1/staff/check').send({
      member_id: 'm1',
      direction: 'in',
      at: '2025-08-11T09:00:00.000Z',
      source: 'nfc',
      device_id: 'gate-1',
    });
    expect(checkIn.status).toBe(200);
    expect(checkIn.body.checkInAt).toBe('2025-08-11T09:00:00.000Z');
    expect(checkIn.body.status).toBe('present');

    const shortOut = await request(app).post('/api/attendance/t1/staff/check').send({
      member_id: 'm1',
      direction: 'out',
      at: '2025-08-11T11:00:00.000Z',
      source: 'nfc',
    });
    expect(shortOut.status).toBe(200);
    expect(shortOut.body.minutesOnPremises).toBe(120);
    expect(shortOut.body.status).toBe('half_day');

    await request(app).post('/api/attendance/t1/staff/check').send({
      member_id: 'm2',
      direction: 'in',
      at: '2025-08-12T08:00:00.000Z',
      source: 'qr',
    });
    const fullOut = await request(app).post('/api/attendance/t1/staff/check').send({
      member_id: 'm2',
      direction: 'out',
      at: '2025-08-12T14:00:00.000Z',
      source: 'qr',
    });
    expect(fullOut.body.minutesOnPremises).toBe(360);
    expect(fullOut.body.status).toBe('present');
  });

  it('bulk mark and monthly totals', async () => {
    const mark = await request(app).post('/api/attendance/t1/staff/mark').send({
      date: '2025-08-15',
      marked_by: 'admin-1',
      marks: [
        { member_id: 'm1', status: 'present' },
        { member_id: 'm2', status: 'absent' },
        { member_id: 'm3', status: 'on_leave' },
        { member_id: 'm4', status: 'half_day' },
      ],
    });
    expect(mark.status).toBe(200);
    expect(mark.body.records).toHaveLength(4);

    await request(app).post('/api/attendance/t1/staff/check').send({
      member_id: 'm5',
      direction: 'in',
      at: '2025-08-16T09:00:00.000Z',
      source: 'manual',
    });
    await request(app).post('/api/attendance/t1/staff/check').send({
      member_id: 'm5',
      direction: 'out',
      at: '2025-08-16T11:00:00.000Z',
      source: 'manual',
    });

    const month = await request(app).get('/api/attendance/t1/staff?month=2025-08');
    expect(month.status).toBe(200);
    expect(month.body.totals).toEqual({
      present: 1,
      absent: 1,
      on_leave: 1,
      half_day: 2,
      total_minutes: 120,
    });
    expect(month.body.records.length).toBeGreaterThanOrEqual(5);

    const filtered = await request(app).get(
      '/api/attendance/t1/staff?month=2025-08&member_id=m2',
    );
    expect(filtered.body.records).toHaveLength(1);
    expect(filtered.body.records[0].memberId).toBe('m2');
  });

  it('finalize locks the month and emits event', async () => {
    await request(app).post('/api/attendance/t1/staff/mark').send({
      date: '2025-09-01',
      marked_by: 'admin',
      marks: [{ member_id: 'm1', status: 'present' }],
    });

    const fin = await request(app).post('/api/attendance/t1/staff/finalize').send({
      month: '2025-09',
      finalized_by: 'payroll',
    });
    expect(fin.status).toBe(200);
    expect(fin.body.locked).toBe(true);
    expect(
      publisher.events.some((e) => e.type === 'school.staff.attendance_finalized'),
    ).toBe(true);

    const blocked = await request(app).post('/api/attendance/t1/staff/mark').send({
      date: '2025-09-02',
      marked_by: 'admin',
      marks: [{ member_id: 'm1', status: 'absent' }],
    });
    expect(blocked.status).toBe(409);

    const checkBlocked = await request(app).post('/api/attendance/t1/staff/check').send({
      member_id: 'm9',
      direction: 'in',
      at: '2025-09-03T09:00:00.000Z',
      source: 'nfc',
    });
    expect(checkBlocked.status).toBe(409);

    const again = await request(app).post('/api/attendance/t1/staff/finalize').send({
      month: '2025-09',
    });
    expect(again.status).toBe(409);
  });

  it('isolates staff attendance by tenant', async () => {
    await request(app).post('/api/attendance/t1/staff/mark').send({
      date: '2025-10-01',
      marked_by: 'a',
      marks: [{ member_id: 'm1', status: 'present' }],
    });
    await request(app).post('/api/attendance/t2/staff/mark').send({
      date: '2025-10-01',
      marked_by: 'a',
      marks: [{ member_id: 'm1', status: 'absent' }],
    });

    const t1 = await request(app).get('/api/attendance/t1/staff?month=2025-10');
    const t2 = await request(app).get('/api/attendance/t2/staff?month=2025-10');
    expect(t1.body.records[0].status).toBe('present');
    expect(t2.body.records[0].status).toBe('absent');
    expect(t1.body.totals.present).toBe(1);
    expect(t2.body.totals.absent).toBe(1);
  });
});
