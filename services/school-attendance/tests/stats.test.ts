import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  computeMonth,
  createSchoolAttendanceApp,
  deriveDayPresent,
  type AttendanceRecord,
} from '../src/index';
import type { SchoolAttendanceSqlite } from '../src/db';

function rec(
  partial: Partial<AttendanceRecord> & Pick<AttendanceRecord, 'studentId' | 'date' | 'status'>,
): AttendanceRecord {
  return {
    id: partial.id ?? `${partial.studentId}-${partial.date}-${partial.status}`,
    tenantId: partial.tenantId ?? 't1',
    studentId: partial.studentId,
    date: partial.date,
    periodInstanceId: partial.periodInstanceId ?? null,
    sessionPart: partial.sessionPart ?? null,
    status: partial.status,
    excuse: partial.excuse ?? 'unknown',
    reasonCodeId: partial.reasonCodeId ?? null,
    lateMinutes: partial.lateMinutes ?? null,
    markedBy: partial.markedBy ?? 't',
    markedAt: partial.markedAt ?? '2025-08-01T00:00:00.000Z',
    source: partial.source ?? 'roll_call',
    deviceId: partial.deviceId ?? null,
    idempotencyKey: partial.idempotencyKey ?? null,
    createdAt: '',
    updatedAt: '',
  };
}

describe('attendance-stats pure derivation (P2-07)', () => {
  it('applies any_absent, majority, and half_day_minutes rules', () => {
    const mixed = [
      rec({ studentId: 's1', date: '2025-08-04', status: 'present', periodInstanceId: 'p1' }),
      rec({ studentId: 's1', date: '2025-08-04', status: 'absent', periodInstanceId: 'p2' }),
    ];
    expect(deriveDayPresent(mixed, 'any_absent', 180)).toBe(false);
    expect(deriveDayPresent(mixed, 'majority', 180)).toBe(true);

    const mostlyAbsent = [
      rec({ studentId: 's1', date: '2025-08-05', status: 'absent', periodInstanceId: 'p1' }),
      rec({ studentId: 's1', date: '2025-08-05', status: 'absent', periodInstanceId: 'p2' }),
      rec({ studentId: 's1', date: '2025-08-05', status: 'present', periodInstanceId: 'p3' }),
    ];
    expect(deriveDayPresent(mostlyAbsent, 'majority', 180)).toBe(false);

    const halfOk = [
      rec({ studentId: 's1', date: '2025-08-06', status: 'present', periodInstanceId: 'p1' }),
      rec({ studentId: 's1', date: '2025-08-06', status: 'absent', periodInstanceId: 'p2' }),
    ];
    // share=90 each; present contributes 90 >= 90 threshold
    expect(deriveDayPresent(halfOk, 'half_day_minutes', 180)).toBe(true);

    const halfFail = [
      rec({
        studentId: 's1',
        date: '2025-08-07',
        status: 'late',
        periodInstanceId: 'p1',
        lateMinutes: 80,
      }),
      rec({ studentId: 's1', date: '2025-08-07', status: 'absent', periodInstanceId: 'p2' }),
    ];
    // share=90; late score=10; total=10 < 90
    expect(deriveDayPresent(halfFail, 'half_day_minutes', 180)).toBe(false);
  });

  it('computeMonth fills unmarked working days as absent', () => {
    const rows = computeMonth({
      tenantId: 't1',
      month: '2025-08',
      workingDayCount: 20,
      dayDerivation: 'majority',
      halfDayMinMinutes: 180,
      records: [
        rec({ studentId: 's1', date: '2025-08-04', status: 'present' }),
        rec({ studentId: 's1', date: '2025-08-05', status: 'absent' }),
        rec({ studentId: 's1', date: '2025-08-05', status: 'late', lateMinutes: 5 }),
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].presentDays).toBe(2);
    expect(rows[0].absentDays).toBe(18);
    expect(rows[0].lateCount).toBe(1);
    expect(rows[0].pct).toBe(10);
  });
});

describe('school-attendance rollups API (P2-07)', () => {
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

  async function mark(
    tenant: string,
    date: string,
    studentId: string,
    status: string,
    key: string,
    extra: Record<string, unknown> = {},
  ) {
    return request(app)
      .post(`/api/attendance/${tenant}/mark`)
      .send({
        context: { date },
        marks: [{ student_id: studentId, status, ...extra }],
        marked_by: 't',
        idempotency_key: key,
      });
  }

  it('computes rollups idempotently and lists by month/student', async () => {
    await mark('t1', '2025-08-04', 's1', 'present', 'r1');
    await mark('t1', '2025-08-05', 's1', 'absent', 'r2');
    await mark('t1', '2025-08-04', 's2', 'present', 'r3');

    const first = await request(app).post('/api/attendance/t1/rollups/compute').send({
      month: '2025-08',
      working_days: 20,
    });
    expect(first.status).toBe(200);
    expect(first.body.rollups).toHaveLength(2);
    const s1 = first.body.rollups.find((r: { studentId: string }) => r.studentId === 's1');
    expect(s1.presentDays).toBe(1);
    expect(s1.absentDays).toBe(19);
    expect(s1.pct).toBe(5);

    const second = await request(app).post('/api/attendance/t1/rollups/compute').send({
      month: '2025-08',
      working_days: 20,
    });
    expect(second.status).toBe(200);
    expect(second.body.rollups).toHaveLength(2);
    const count = await db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM attendance_monthly_rollups WHERE tenant_id = ?',
      ['t1'],
    );
    expect(Number(count?.c)).toBe(2);

    const listed = await request(app).get('/api/attendance/t1/rollups?month=2025-08');
    expect(listed.body.rollups).toHaveLength(2);

    const student = await request(app).get('/api/attendance/t1/students/s1/rollups');
    expect(student.body.rollups).toHaveLength(1);
    expect(student.body.rollups[0].month).toBe('2025-08');
  });

  it('respects day_derivation setting for rollups', async () => {
    await request(app).put('/api/attendance/t1/settings').send({
      granularity: 'period',
      day_derivation: 'any_absent',
    });
    await request(app)
      .post('/api/attendance/t1/mark')
      .send({
        context: { date: '2025-08-11', period_instance_id: 'p1' },
        marks: [{ student_id: 's1', status: 'present' }],
        marked_by: 't',
        idempotency_key: 'p-a',
      });
    await request(app)
      .post('/api/attendance/t1/mark')
      .send({
        context: { date: '2025-08-11', period_instance_id: 'p2' },
        marks: [{ student_id: 's1', status: 'absent' }],
        marked_by: 't',
        idempotency_key: 'p-b',
      });

    const anyAbsent = await request(app).post('/api/attendance/t1/rollups/compute').send({
      month: '2025-08',
      working_days: 10,
    });
    expect(anyAbsent.body.rollups[0].presentDays).toBe(0);

    await request(app).put('/api/attendance/t1/settings').send({
      day_derivation: 'majority',
    });
    const majority = await request(app).post('/api/attendance/t1/rollups/compute').send({
      month: '2025-08',
      working_days: 10,
    });
    expect(majority.body.rollups[0].presentDays).toBe(1);
  });

  it('computes eligibility with projection and isolates tenants', async () => {
    // Fixed weekday window: 2025-08-04 (Mon) .. 2025-08-08 (Fri) = 5 weekdays
    await mark('t1', '2025-08-04', 's1', 'present', 'e1');
    await mark('t1', '2025-08-05', 's1', 'present', 'e2');
    await mark('t1', '2025-08-06', 's1', 'absent', 'e3');
    await mark('t2', '2025-08-04', 's1', 'absent', 'e4');

    const elig = await request(app).get(
      '/api/attendance/t1/students/s1/eligibility?session_from=2025-08-04&session_to=2025-08-08&threshold=75',
    );
    expect(elig.status).toBe(200);
    expect(elig.body.pct).toBe(40);
    expect(elig.body.eligible).toBe(false);
    expect(elig.body.threshold).toBe(75);
    // asOf=today > session_to ⇒ remaining=0 ⇒ projected == pct
    expect(elig.body.projected_pct_if_no_more_absences).toBe(40);

    // Future Mon–Fri session: one present day so far → projection fills remaining weekdays
    const from = '2026-08-17'; // Mon
    const to = '2026-08-21'; // Fri
    await mark('t1', from, 's9', 'present', 'fut-1');
    const proj = await request(app).get(
      `/api/attendance/t1/students/s9/eligibility?session_from=${from}&session_to=${to}&threshold=75`,
    );
    expect(proj.status).toBe(200);
    expect(proj.body.pct).toBe(20);
    expect(proj.body.projected_pct_if_no_more_absences).toBe(100);
    expect(proj.body.eligible).toBe(false);

    const t2 = await request(app).get(
      '/api/attendance/t2/students/s1/eligibility?session_from=2025-08-04&session_to=2025-08-08&threshold=75',
    );
    expect(t2.body.pct).toBe(0);
    expect(t2.body.eligible).toBe(false);

    const settings = await request(app).get('/api/attendance/t1/settings');
    expect(settings.body.dayDerivation).toBe('majority');
  });
});
