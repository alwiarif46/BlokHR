import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolAttendanceApp } from '../src/index';
import { staff, guardian, internalOnly, SECRET } from './helpers/auth';
import type { SchoolAttendanceSqlite } from '../src/db';

describe('school-attendance settings', () => {
  let app: Express;
  let db: SchoolAttendanceSqlite;

  beforeEach(async () => {
    const created = await createSchoolAttendanceApp({
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

  it('returns defaults on first settings read', async () => {
    const res = await request(app).get('/api/attendance/t1/settings').set(staff('school_admin'));
    expect(res.status).toBe(200);
    expect(res.body.granularity).toBe('day');
    expect(res.body.editWindowMinutes).toBe(120);
    expect(res.body.lateThresholdMinutes).toBe(30);
    expect(res.body.halfDayMinMinutes).toBe(180);
    expect(res.body.dayDerivation).toBe('majority');
  });

  it('updates settings and validates ranges', async () => {
    const updated = await request(app).put('/api/attendance/t1/settings').set(staff('school_admin')).send({
      granularity: 'period',
      edit_window_minutes: 60,
      late_threshold_minutes: 15,
      half_day_min_minutes: 200,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.granularity).toBe('period');
    expect(updated.body.editWindowMinutes).toBe(60);
    expect(updated.body.lateThresholdMinutes).toBe(15);
    expect(updated.body.halfDayMinMinutes).toBe(200);

    const got = await request(app).get('/api/attendance/t1/settings').set(staff('school_admin'));
    expect(got.body.granularity).toBe('period');

    const badGranularity = await request(app).put('/api/attendance/t1/settings').set(staff('school_admin')).send({
      granularity: 'week',
    });
    expect(badGranularity.status).toBe(400);

    const badEdit = await request(app).put('/api/attendance/t1/settings').set(staff('school_admin')).send({
      edit_window_minutes: 2000,
    });
    expect(badEdit.status).toBe(400);

    const badLate = await request(app).put('/api/attendance/t1/settings').set(staff('school_admin')).send({
      late_threshold_minutes: 2,
    });
    expect(badLate.status).toBe(400);

    const badHalf = await request(app).put('/api/attendance/t1/settings').set(staff('school_admin')).send({
      half_day_min_minutes: 30,
    });
    expect(badHalf.status).toBe(400);
  });

  it('migration boots with records/audit/settings tables', async () => {
    const tables = await db.all<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    );
    const names = tables.map((t) => t.name);
    expect(names).toContain('attendance_records');
    expect(names).toContain('attendance_audit');
    expect(names).toContain('attendance_settings');
    expect(names).toContain('reason_codes');
  });

  it('isolates settings per tenant', async () => {
    await request(app).put('/api/attendance/tenant-a/settings').set(staff('school_admin')).send({
      granularity: 'session',
    });
    const b = await request(app).get('/api/attendance/tenant-b/settings').set(staff('school_admin'));
    expect(b.body.granularity).toBe('day');
    const a = await request(app).get('/api/attendance/tenant-a/settings').set(staff('school_admin'));
    expect(a.body.granularity).toBe('session');
  });
});
