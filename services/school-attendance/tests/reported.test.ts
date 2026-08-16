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

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysUtc(isoDate: string, days: number): string {
  const ms = Date.parse(`${isoDate}T00:00:00.000Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

describe('school-attendance reported absences (P2-06)', () => {
  let app: Express;
  let db: SchoolAttendanceSqlite;
  let publisher: RecordingPublisher;
  let today: string;
  let tomorrow: string;

  beforeEach(async () => {
    publisher = new RecordingPublisher();
    today = todayUtc();
    tomorrow = addDaysUtc(today, 1);
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

  it('validates dates and merges resubmissions idempotently', async () => {
    const reason = await sickCode();
    const past = await request(app).post('/api/attendance/t1/reported-absences').set(staff('school_admin')).send({
      student_id: 's1',
      reported_by_guardian_id: 'g1',
      dates: [addDaysUtc(today, -1)],
      reason_code_id: reason,
      channel: 'app',
    });
    expect(past.status).toBe(400);

    const tooFar = await request(app).post('/api/attendance/t1/reported-absences').set(staff('school_admin')).send({
      student_id: 's1',
      reported_by_guardian_id: 'g1',
      dates: [addDaysUtc(today, 31)],
      reason_code_id: reason,
      channel: 'app',
    });
    expect(tooFar.status).toBe(400);

    const tooMany = await request(app).post('/api/attendance/t1/reported-absences').set(staff('school_admin')).send({
      student_id: 's1',
      reported_by_guardian_id: 'g1',
      dates: Array.from({ length: 16 }, (_, i) => addDaysUtc(today, i)),
      reason_code_id: reason,
      channel: 'web',
    });
    expect(tooMany.status).toBe(400);

    const first = await request(app).post('/api/attendance/t1/reported-absences').set(staff('school_admin')).send({
      student_id: 's1',
      reported_by_guardian_id: 'g1',
      dates: [today, tomorrow],
      reason_code_id: reason,
      channel: 'app',
      note: 'fever',
    });
    expect(first.status).toBe(201);
    expect(first.body.merged).toBe(false);
    expect(first.body.dates).toEqual([today, tomorrow]);

    const day3 = addDaysUtc(today, 2);
    const merge = await request(app).post('/api/attendance/t1/reported-absences').set(staff('school_admin')).send({
      student_id: 's1',
      reported_by_guardian_id: 'g1',
      dates: [tomorrow, day3],
      reason_code_id: reason,
      channel: 'whatsapp',
    });
    expect(merge.status).toBe(200);
    expect(merge.body.merged).toBe(true);
    expect(merge.body.id).toBe(first.body.id);
    expect(merge.body.dates).toEqual([today, tomorrow, day3]);

    const count = await db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM reported_absences WHERE tenant_id = ?',
      ['t1'],
    );
    expect(Number(count?.c)).toBe(1);

    const attach = await request(app)
      .post(`/api/attendance/t1/reported-absences/${first.body.id}/attach`).set(staff('school_admin'))
      .send({ attachment_ref: 'storage://certs/s1-med.pdf' });
    expect(attach.status).toBe(200);
    expect(attach.body.attachmentRef).toBe('storage://certs/s1-med.pdf');
  });

  it('report-then-mark sets explained:true and excused excuse', async () => {
    const reason = await sickCode();
    await request(app).post('/api/attendance/t1/reported-absences').set(staff('school_admin')).send({
      student_id: 's1',
      reported_by_guardian_id: 'g1',
      dates: [today],
      reason_code_id: reason,
      channel: 'app',
    });

    const mark = await request(app).post('/api/attendance/t1/mark').set(staff('school_admin')).send({
      context: { date: today },
      marks: [{ student_id: 's1', status: 'absent' }],
      marked_by: 'teacher',
      idempotency_key: 'rpt-then-mark',
    });
    expect(mark.status).toBe(200);
    expect(mark.body.records[0].excuse).toBe('excused');
    expect(mark.body.records[0].reasonCodeId).toBe(reason);

    const absentEvt = publisher.events.find((e) => e.type === 'school.attendance.marked_absent');
    expect(absentEvt?.data.explained).toBe(true);
  });

  it('mark-then-report retro-updates excuse and emits explained', async () => {
    const reason = await sickCode();
    const mark = await request(app).post('/api/attendance/t1/mark').set(staff('school_admin')).send({
      context: { date: today },
      marks: [
        { student_id: 's1', status: 'absent' },
        { student_id: 's2', status: 'absent' },
      ],
      marked_by: 'teacher',
      idempotency_key: 'mark-then-rpt',
    });
    expect(mark.status).toBe(200);
    const unmarkedEvt = publisher.events.find(
      (e) => e.type === 'school.attendance.marked_absent' && e.data.student_id === 's1',
    );
    expect(unmarkedEvt?.data.explained).toBe(false);

    publisher.events = [];
    const report = await request(app).post('/api/attendance/t1/reported-absences').set(staff('school_admin')).send({
      student_id: 's1',
      reported_by_guardian_id: 'g1',
      dates: [today],
      reason_code_id: reason,
      channel: 'ivr',
    });
    expect(report.status).toBe(201);

    const explained = publisher.events.filter((e) => e.type === 'school.attendance.explained');
    expect(explained).toHaveLength(1);
    expect(explained[0].data.student_id).toBe('s1');

    const register = await request(app).get(
      `/api/attendance/t1/register?date=${today}&student_ids=s1,s2`
    ).set(staff('school_admin'));
    expect(register.body.register.s1.excuse).toBe('excused');
    expect(register.body.register.s2.excuse).toBe('unknown');
  });

  it('unexplained worklist and tenant isolation', async () => {
    const reason = await sickCode();
    const reason2 = await sickCode('t2');

    await request(app).post('/api/attendance/t1/mark').set(staff('school_admin')).send({
      context: { date: today },
      marks: [
        { student_id: 's1', status: 'absent' },
        { student_id: 's2', status: 'absent' },
      ],
      marked_by: 't',
      idempotency_key: 'u1',
    });
    await request(app).post('/api/attendance/t1/reported-absences').set(staff('school_admin')).send({
      student_id: 's1',
      reported_by_guardian_id: 'g1',
      dates: [today],
      reason_code_id: reason,
      channel: 'app',
    });

    const worklist = await request(app).get(`/api/attendance/t1/unexplained?date=${today}`).set(staff('school_admin'));
    expect(worklist.status).toBe(200);
    expect(worklist.body.unexplained).toHaveLength(1);
    expect(worklist.body.unexplained[0].studentId).toBe('s2');
    expect(worklist.body.unexplained[0].explained).toBe(false);

    await request(app).post('/api/attendance/t2/reported-absences').set(staff('school_admin')).send({
      student_id: 's1',
      reported_by_guardian_id: 'g1',
      dates: [today],
      reason_code_id: reason2,
      channel: 'app',
    });
    const t2 = await request(app).get(`/api/attendance/t2/unexplained?date=${today}`).set(staff('school_admin'));
    expect(t2.body.unexplained).toHaveLength(0);
  });
});
