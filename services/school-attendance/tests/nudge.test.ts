import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  assignCohort,
  createSchoolAttendanceApp,
  studentHoldoutBucket,
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

describe('nudge math stability', () => {
  it('assigns holdout deterministically and stably', () => {
    const a = assignCohort('student-stable-1', 10);
    const b = assignCohort('student-stable-1', 10);
    expect(a).toBe(b);
    expect(studentHoldoutBucket('student-stable-1')).toBe(
      studentHoldoutBucket('student-stable-1'),
    );
    expect(studentHoldoutBucket('student-stable-1')).toBeGreaterThanOrEqual(0);
    expect(studentHoldoutBucket('student-stable-1')).toBeLessThan(100);
  });
});

describe('school-attendance nudge (P2-08)', () => {
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

  async function seedRollup(
    tenant: string,
    studentId: string,
    month: string,
    present: number,
    absent: number,
    working = present + absent,
  ) {
    await db.run(
      `INSERT INTO attendance_monthly_rollups (
         tenant_id, student_id, month, working_days, present_days, absent_days,
         late_count, pct, computed_at
       ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, datetime('now'))
       ON CONFLICT(tenant_id, student_id, month) DO UPDATE SET
         working_days = excluded.working_days,
         present_days = excluded.present_days,
         absent_days = excluded.absent_days,
         pct = excluded.pct`,
      [
        tenant,
        studentId,
        month,
        working,
        present,
        absent,
        working === 0 ? 0 : (present / working) * 100,
      ],
    );
  }

  async function enable(tenant: string, patch: Record<string, unknown> = {}) {
    await request(app)
      .put(`/api/attendance/${tenant}/nudge/config`)
      .send({ enabled: true, holdout_pct: 0, ...patch });
  }

  it('disabled config is a no-op', async () => {
    await seedRollup('t1', 's1', '2025-08', 10, 10);
    const run = await request(app).post('/api/attendance/t1/nudge/run').send({
      as_of: '2025-08-31',
      class_map: { s1: 'A' },
    });
    expect(run.status).toBe(200);
    expect(run.body.sent).toHaveLength(0);
    expect(publisher.events.filter((e) => e.type === 'school.nudge.send')).toHaveLength(0);
  });

  it('tiers at_risk vs chronic and emits vars with precise dates', async () => {
    await enable('t1', { at_risk_pct: 10, chronic_days: 18, holdout_pct: 0 });
    await seedRollup('t1', 'risk-kid', '2025-08', 85, 15); // ~15% absent, <18 days → at_risk
    await seedRollup('t1', 'chronic-kid', '2025-08', 2, 20); // 20 absent days → chronic

    await db.run(
      `INSERT INTO attendance_records (
         id, tenant_id, student_id, date, status, excuse
       ) VALUES
         ('a1', 't1', 'risk-kid', '2025-08-01', 'absent', 'unknown'),
         ('a2', 't1', 'risk-kid', '2025-08-02', 'absent', 'unknown'),
         ('a3', 't1', 'risk-kid', '2025-08-03', 'absent', 'unknown'),
         ('a4', 't1', 'risk-kid', '2025-08-04', 'absent', 'unknown')`,
    );

    const run = await request(app).post('/api/attendance/t1/nudge/run').send({
      as_of: '2025-08-31',
      class_map: { 'risk-kid': 'A', 'chronic-kid': 'A' },
    });
    expect(run.status).toBe(200);
    expect(run.body.sent).toHaveLength(2);
    const tiers = run.body.sent.map((m: { tier: string }) => m.tier).sort();
    expect(tiers).toEqual(['at_risk', 'chronic']);

    const evt = publisher.events.find(
      (e) => e.type === 'school.nudge.send' && e.data.student_id === 'risk-kid',
    );
    expect(evt).toBeTruthy();
    expect(evt!.data.template).toBe('attendance_nudge');
    const vars = evt!.data.vars as {
      days_missed: number;
      percentile: number;
      precise_dates: string[];
    };
    expect(vars.days_missed).toBe(15);
    expect(vars.precise_dates).toEqual(['2025-08-04', '2025-08-03', '2025-08-02']);
    expect(typeof vars.percentile).toBe('number');
  });

  it('skips holdout cohort stably and respects term cap', async () => {
    let holdoutId = '';
    let treatmentId = '';
    for (let i = 0; i < 200; i++) {
      const id = `holdout-probe-${i}`;
      if (!holdoutId && assignCohort(id, 50) === 'holdout') holdoutId = id;
      if (!treatmentId && assignCohort(id, 50) === 'treatment') treatmentId = id;
      if (holdoutId && treatmentId) break;
    }
    expect(holdoutId).toBeTruthy();
    expect(treatmentId).toBeTruthy();

    await enable('t1', {
      holdout_pct: 50,
      at_risk_pct: 5,
      chronic_days: 100,
      max_messages_per_term: 1,
    });
    await seedRollup('t1', holdoutId, '2025-08', 50, 50);
    await seedRollup('t1', treatmentId, '2025-08', 50, 50);

    const first = await request(app).post('/api/attendance/t1/nudge/run').send({
      as_of: '2025-08-31',
      class_map: { [holdoutId]: 'B', [treatmentId]: 'B' },
    });
    expect(first.body.sent.map((m: { studentId: string }) => m.studentId)).toEqual([
      treatmentId,
    ]);

    const again = await request(app).post('/api/attendance/t1/nudge/run').send({
      as_of: '2025-08-31',
      class_map: { [holdoutId]: 'B', [treatmentId]: 'B' },
    });
    expect(again.body.sent).toHaveLength(0);

    const assign1 = await db.get<{ cohort: string }>(
      'SELECT cohort FROM nudge_assignments WHERE tenant_id = ? AND student_id = ?',
      ['t1', holdoutId],
    );
    const assign2 = await db.get<{ cohort: string }>(
      'SELECT cohort FROM nudge_assignments WHERE tenant_id = ? AND student_id = ?',
      ['t1', holdoutId],
    );
    expect(assign1?.cohort).toBe('holdout');
    expect(assign2?.cohort).toBe(assign1?.cohort);
  });

  it('suppresses improving students', async () => {
    await enable('t1', { holdout_pct: 0, at_risk_pct: 10, chronic_days: 100 });
    // YTD poor attendance (~25%)
    await seedRollup('t1', 'improving', '2025-07', 5, 15);
    await seedRollup('t1', 'improving', '2025-08', 5, 15);
    // Fill last-30d window with presents so recent pct >> YTD pct
    const days: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.parse('2025-08-22T00:00:00.000Z') - i * 86_400_000);
      const iso = d.toISOString().slice(0, 10);
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6) days.push(iso);
    }
    for (const d of days) {
      await db.run(
        `INSERT INTO attendance_records (id, tenant_id, student_id, date, status, excuse)
         VALUES (?, 't1', 'improving', ?, 'present', 'unknown')`,
        [`imp-${d}`, d],
      );
    }
    const marked = await db.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM attendance_records WHERE tenant_id='t1' AND student_id='improving'`,
    );
    expect(Number(marked?.c)).toBe(days.length);
    expect(days.length).toBeGreaterThan(15);

    const run = await request(app).post('/api/attendance/t1/nudge/run').send({
      as_of: '2025-08-22',
      class_map: { improving: 'C' },
    });
    expect(run.body.sent).toHaveLength(0);
    expect(run.body.skipped).toBeGreaterThan(0);
  });

  it('report math and tenant isolation', async () => {
    await enable('t1', { holdout_pct: 0, at_risk_pct: 5 });
    await enable('t2', { holdout_pct: 0, at_risk_pct: 5 });
    await seedRollup('t1', 's1', '2025-08', 50, 50);
    await seedRollup('t2', 's1', '2025-08', 90, 10);

    await request(app).post('/api/attendance/t1/nudge/run').send({
      as_of: '2025-08-31',
      class_map: { s1: 'A' },
    });
    await request(app).post('/api/attendance/t2/nudge/run').send({
      as_of: '2025-08-31',
      class_map: { s1: 'A' },
    });

    const r1 = await request(app).get('/api/attendance/t1/nudge/report');
    const r2 = await request(app).get('/api/attendance/t2/nudge/report');
    expect(r1.status).toBe(200);
    expect(r1.body.treatment.message_count).toBe(1);
    expect(r1.body.treatment.mean_absence_pct).toBe(50);
    expect(r2.body.treatment.mean_absence_pct).toBe(10);
    expect(r2.body.treatment.message_count).toBe(1);
  });
});
