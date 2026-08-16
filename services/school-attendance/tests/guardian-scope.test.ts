import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolAttendanceApp,
  type SchoolAttendanceSqlite,
} from '../src/index';

const SECRET = 'test-internal-secret';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysUtc(isoDate: string, days: number): string {
  const ms = Date.parse(`${isoDate}T00:00:00.000Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

describe('school-attendance guardian scope (P9-03)', () => {
  let app: Express;
  let db: SchoolAttendanceSqlite;
  let today: string;
  let tomorrow: string;

  beforeEach(async () => {
    today = todayUtc();
    tomorrow = addDaysUtc(today, 1);
    const created = await createSchoolAttendanceApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  async function sickCode() {
    const codes = await request(app).get('/api/attendance/t1/reason-codes');
    return codes.body.reasonCodes.find((c: { code: string }) => c.code === 'SICK')
      .id as string;
  }

  it('forces guardian id from header and blocks unlinked students', async () => {
    const reason = await sickCode();

    const spoof = await request(app)
      .post('/api/attendance/t1/reported-absences')
      .set('X-Blok-Internal', SECRET)
      .set('X-Blok-Principal', 'guardian')
      .set('X-Blok-Guardian', 'real-g')
      .set('X-Blok-Students', 's1')
      .send({
        student_id: 's1',
        reported_by_guardian_id: 'spoofed-g',
        dates: [tomorrow],
        reason_code_id: reason,
        channel: 'app',
      });
    expect(spoof.status).toBe(201);
    expect(spoof.body.reportedByGuardianId).toBe('real-g');

    const unlinked = await request(app)
      .post('/api/attendance/t1/reported-absences')
      .set('X-Blok-Internal', SECRET)
      .set('X-Blok-Principal', 'guardian')
      .set('X-Blok-Guardian', 'real-g')
      .set('X-Blok-Students', 's1')
      .send({
        student_id: 's-other',
        reported_by_guardian_id: 'spoofed-g',
        dates: [tomorrow],
        reason_code_id: reason,
        channel: 'app',
      });
    expect(unlinked.status).toBe(403);

    const noSecret = await request(app)
      .post('/api/attendance/t1/reported-absences')
      .set('X-Blok-Principal', 'guardian')
      .set('X-Blok-Guardian', 'real-g')
      .set('X-Blok-Students', 's1')
      .send({
        student_id: 's1',
        reported_by_guardian_id: 'g',
        dates: [addDaysUtc(today, 2)],
        reason_code_id: reason,
        channel: 'app',
      });
    expect(noSecret.status).toBe(401);

    const staff = await request(app).post('/api/attendance/t1/reported-absences').send({
      student_id: 's2',
      reported_by_guardian_id: 'office-g',
      dates: [addDaysUtc(today, 3)],
      reason_code_id: reason,
      channel: 'app',
    });
    expect(staff.status).toBe(201);
    expect(staff.body.reportedByGuardianId).toBe('office-g');
  });

  it('summary requires linked student and returns shape', async () => {
    const noPrincipal = await request(app).get(
      '/api/attendance/t1/guardian/students/s1/summary?from=2026-01-01&to=2026-01-31',
    );
    expect(noPrincipal.status).toBe(401);

    const unlinked = await request(app)
      .get(
        '/api/attendance/t1/guardian/students/s9/summary?from=2026-01-01&to=2026-01-31',
      )
      .set('X-Blok-Internal', SECRET)
      .set('X-Blok-Principal', 'guardian')
      .set('X-Blok-Guardian', 'g1')
      .set('X-Blok-Students', 's1');
    expect(unlinked.status).toBe(403);

    const ok = await request(app)
      .get(
        '/api/attendance/t1/guardian/students/s1/summary?from=2026-01-01&to=2026-01-31',
      )
      .set('X-Blok-Internal', SECRET)
      .set('X-Blok-Principal', 'guardian')
      .set('X-Blok-Guardian', 'g1')
      .set('X-Blok-Students', 's1,s2');
    expect(ok.status).toBe(200);
    expect(ok.body).toHaveProperty('records');
    expect(ok.body).toHaveProperty('monthly');
    expect(ok.body).toHaveProperty('eligibility_pct');
  });
});
