import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolAttendanceApp } from '../src/index';
import { staff, guardian, internalOnly, SECRET } from './helpers/auth';
import type { SchoolAttendanceSqlite } from '../src/db';

describe('school-attendance reason codes', () => {
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

  it('health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('seeds default reason codes on first read', async () => {
    const res = await request(app).get('/api/attendance/t1/reason-codes').set(staff('school_admin'));
    expect(res.status).toBe(200);
    expect(res.body.reasonCodes).toHaveLength(5);
    const codes = res.body.reasonCodes.map((r: { code: string }) => r.code).sort();
    expect(codes).toEqual([
      'FAMILY',
      'MEDICAL_APPT',
      'SCHOOL_EVENT',
      'SICK',
      'UNEXPLAINED',
    ]);

    const sick = res.body.reasonCodes.find((r: { code: string }) => r.code === 'SICK');
    expect(sick.bucket).toBe('medical');
  });

  it('creates and patches reason codes; bucket is immutable', async () => {
    await request(app).get('/api/attendance/t1/reason-codes').set(staff('school_admin'));

    const created = await request(app).post('/api/attendance/t1/reason-codes').set(staff('school_admin')).send({
      code: 'trip',
      label: 'Educational trip',
      bucket: 'school_activity',
      sort: 60,
    });
    expect(created.status).toBe(201);
    expect(created.body.code).toBe('TRIP');
    expect(created.body.bucket).toBe('school_activity');

    const patched = await request(app)
      .patch(`/api/attendance/t1/reason-codes/${created.body.id}`).set(staff('school_admin'))
      .send({ label: 'School trip', is_active: false });
    expect(patched.status).toBe(200);
    expect(patched.body.label).toBe('School trip');
    expect(patched.body.isActive).toBe(false);

    const badBucket = await request(app)
      .patch(`/api/attendance/t1/reason-codes/${created.body.id}`).set(staff('school_admin'))
      .send({ bucket: 'medical' });
    expect(badBucket.status).toBe(400);
    expect(badBucket.body.error).toMatch(/immutable/i);
  });

  it('isolates tenants', async () => {
    await request(app).get('/api/attendance/tenant-a/reason-codes').set(staff('school_admin'));
    await request(app).post('/api/attendance/tenant-a/reason-codes').set(staff('school_admin')).send({
      code: 'AONLY',
      label: 'A only',
      bucket: 'authorised',
    });

    const b = await request(app).get('/api/attendance/tenant-b/reason-codes').set(staff('school_admin'));
    expect(b.status).toBe(200);
    expect(b.body.reasonCodes).toHaveLength(5);
    expect(b.body.reasonCodes.every((r: { code: string }) => r.code !== 'AONLY')).toBe(
      true,
    );

    const a = await request(app).get('/api/attendance/tenant-a/reason-codes').set(staff('school_admin'));
    expect(a.body.reasonCodes.some((r: { code: string }) => r.code === 'AONLY')).toBe(
      true,
    );
  });
});
