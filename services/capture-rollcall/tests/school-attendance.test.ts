import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createCaptureRollcallApp,
  createSchoolAttendanceApp,
  resolveCaptureRollcallDbPath,
} from '../src/index';
import type { SchoolSqlite } from '../src/db';

const logger = pino({ level: 'silent' });

describe('@blokhr/capture-rollcall', () => {
  let app: Express;
  let db: SchoolSqlite;

  beforeEach(async () => {
    const created = await createCaptureRollcallApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger,
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('roll call mark is idempotent and offline sync works', async () => {
    const cls = await request(app).post('/api/school-attendance/classes').send({ name: '5A' });
    const classId = cls.body.class.id as string;
    await request(app)
      .post(`/api/school-attendance/classes/${classId}/students`)
      .send({ display_name: 'Riya', subject_ref: 'stu_riya' });
    const prd = await request(app)
      .post(`/api/school-attendance/classes/${classId}/periods`)
      .send({ label: 'Period 1', period_date: '2026-08-15' });
    const periodId = prd.body.id as string;

    const m1 = await request(app)
      .post('/api/school-attendance/marks')
      .send({
        period_id: periodId,
        subject_ref: 'stu_riya',
        status: 'present',
        idempotency_key: 'off-1',
      });
    expect(m1.body.success).toBe(true);

    const sync = await request(app)
      .post('/api/school-attendance/marks/sync')
      .send({
        marks: [
          {
            period_id: periodId,
            subject_ref: 'stu_riya',
            status: 'present',
            idempotency_key: 'off-1',
          },
        ],
      });
    expect(sync.body.replayed).toBe(1);

    const bundle = await request(app).get(
      `/api/school-attendance/classes/${classId}/offline-bundle?date=2026-08-15`,
    );
    expect(bundle.body.roster.length).toBe(1);
  });

  it('deprecated createSchoolAttendanceApp alias still works', async () => {
    const created = await createSchoolAttendanceApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger,
    });
    const health = await request(created.app).get('/api/school-attendance/health');
    expect(health.body.status).toBe('ok');
    await created.db.close();
  });
});

describe('resolveCaptureRollcallDbPath', () => {
  it('prefers CAPTURE_ROLLCALL_DB_PATH', () => {
    expect(
      resolveCaptureRollcallDbPath({ CAPTURE_ROLLCALL_DB_PATH: './new.db' }, { warn() {} }),
    ).toBe('./new.db');
  });

  it('falls back to SCHOOL_ATTENDANCE_DB_PATH with deprecation warn', () => {
    const warnings: string[] = [];
    const path = resolveCaptureRollcallDbPath(
      { SCHOOL_ATTENDANCE_DB_PATH: './legacy.db' },
      { warn: (m: string) => warnings.push(String(m)) },
    );
    expect(path).toBe('./legacy.db');
    expect(warnings[0]).toMatch(/SCHOOL_ATTENDANCE_DB_PATH/);
  });
});
