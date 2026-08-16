import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolTimetableApp,
  type DomainEvent,
  type EventPublisher,
} from '../src/index';
import type { SchoolTimetableSqlite } from '../src/db';

class RecordingPublisher implements EventPublisher {
  events: DomainEvent[] = [];
  async publish(e: DomainEvent): Promise<void> {
    this.events.push(e);
  }
}

function periodsOk() {
  return [
    {
      index: 0,
      label: 'P1',
      start_time: '09:00',
      end_time: '09:45',
      is_teaching: 1,
    },
    {
      index: 1,
      label: 'P2',
      start_time: '09:45',
      end_time: '10:30',
      is_teaching: 1,
    },
  ];
}

describe('school-timetable cover', () => {
  let app: Express;
  let db: SchoolTimetableSqlite;
  let publisher: RecordingPublisher;
  let sectionA: string;
  let sectionB: string;
  let allocA: string;
  let allocB: string;

  beforeEach(async () => {
    publisher = new RecordingPublisher();
    const created = await createSchoolTimetableApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      eventPublisher: publisher,
    });
    app = created.app;
    db = created.db;

    const scheme = await request(app).post('/api/timetable/t1/day-schemes').set(staff('school_admin')).send({
      label: 'Weekly',
      kind: 'weekly',
      periods: periodsOk(),
    });

    const secA = await request(app).post('/api/timetable/t1/sections').set(staff('school_admin')).send({
      academic_session_id: 'sess-1',
      class_label: '8',
      section: 'A',
      day_scheme_id: scheme.body.id,
    });
    sectionA = secA.body.id;

    const secB = await request(app).post('/api/timetable/t1/sections').set(staff('school_admin')).send({
      academic_session_id: 'sess-1',
      class_label: '8',
      section: 'B',
      day_scheme_id: scheme.body.id,
    });
    sectionB = secB.body.id;

    const math = await request(app).post('/api/timetable/t1/subjects').set(staff('school_admin')).send({
      code: 'MATH',
      label: 'Mathematics',
    });
    const sci = await request(app).post('/api/timetable/t1/subjects').set(staff('school_admin')).send({
      code: 'SCI',
      label: 'Science',
    });

    const a = await request(app).post('/api/timetable/t1/allocations').set(staff('school_admin')).send({
      section_id: sectionA,
      subject_id: math.body.id,
      teacher_member_id: 'teacher-absent',
      periods_per_week: 4,
    });
    allocA = a.body.id;

    const b = await request(app).post('/api/timetable/t1/allocations').set(staff('school_admin')).send({
      section_id: sectionB,
      subject_id: sci.body.id,
      teacher_member_id: 'teacher-cover',
      periods_per_week: 4,
    });
    allocB = b.body.id;

    await request(app)
      .put(`/api/timetable/t1/sections/${sectionA}/slots`).set(staff('school_admin'))
      .send([
        { day_ref: 'mon', period_index: 0, allocation_id: allocA },
        { day_ref: 'mon', period_index: 1, allocation_id: allocA },
      ]);
    await request(app)
      .put(`/api/timetable/t1/sections/${sectionB}/slots`).set(staff('school_admin'))
      .send([{ day_ref: 'mon', period_index: 0, allocation_id: allocB }]);

    // 2025-08-11 = Monday
    await request(app)
      .post(`/api/timetable/t1/sections/${sectionA}/instances/generate`).set(staff('school_admin'))
      .send({ from: '2025-08-11', to: '2025-08-11' });
    await request(app)
      .post(`/api/timetable/t1/sections/${sectionB}/instances/generate`).set(staff('school_admin'))
      .send({ from: '2025-08-11', to: '2025-08-11' });
  });

  afterEach(async () => {
    await db.close();
  });

  it('fans out absences for full day and specific periods', async () => {
    const full = await request(app).post('/api/timetable/t1/absences').set(staff('school_admin')).send({
      teacher_member_id: 'teacher-absent',
      date: '2025-08-11',
      reason: 'sick',
    });
    expect(full.status).toBe(201);
    expect(full.body.covers).toHaveLength(2);
    expect(
      publisher.events.filter((e) => e.type === 'school.cover.needed'),
    ).toHaveLength(2);

    publisher.events = [];
    const partial = await request(app).post('/api/timetable/t1/absences').set(staff('school_admin')).send({
      teacher_member_id: 'teacher-absent',
      date: '2025-08-11',
      period_indexes: [1],
      reason: 'appointment',
    });
    expect(partial.status).toBe(201);
    expect(partial.body.covers).toHaveLength(1);
    expect(partial.body.covers[0].periodInstanceId).toBeTruthy();
  });

  it('checks free teacher, runs state machine, uncovered→lost, fairness', async () => {
    const absence = await request(app).post('/api/timetable/t1/absences').set(staff('school_admin')).send({
      teacher_member_id: 'teacher-absent',
      date: '2025-08-11',
      period_indexes: [0],
      reason: 'sick',
    });
    const coverId = absence.body.covers[0].id as string;

    // teacher-cover is busy on mon period 0 in section B
    const busy = await request(app)
      .post(`/api/timetable/t1/cover/${coverId}/offer`).set(staff('school_admin'))
      .send({ cover_teacher_member_id: 'teacher-cover' });
    expect(busy.status).toBe(409);

    const free = await request(app)
      .post(`/api/timetable/t1/cover/${coverId}/offer`).set(staff('school_admin'))
      .send({ cover_teacher_member_id: 'teacher-free' });
    expect(free.status).toBe(200);
    expect(free.body.state).toBe('offered');
    expect(publisher.events.some((e) => e.type === 'school.cover.offered')).toBe(true);

    const decline = await request(app)
      .post(`/api/timetable/t1/cover/${coverId}/respond`).set(staff('school_admin'))
      .send({ accept: false });
    expect(decline.status).toBe(200);
    expect(decline.body.state).toBe('open');

    await request(app)
      .post(`/api/timetable/t1/cover/${coverId}/offer`).set(staff('school_admin'))
      .send({ cover_teacher_member_id: 'teacher-free' });
    const accept = await request(app)
      .post(`/api/timetable/t1/cover/${coverId}/respond`).set(staff('school_admin'))
      .send({ accept: true });
    expect(accept.status).toBe(200);
    expect(accept.body.state).toBe('accepted');
    expect(publisher.events.some((e) => e.type === 'school.cover.assigned')).toBe(true);

    const illegal = await request(app)
      .post(`/api/timetable/t1/cover/${coverId}/mark-uncovered`).set(staff('school_admin'))
      .send();
    expect(illegal.status).toBe(409);

    const fairness = await request(app).get(
      '/api/timetable/t1/cover/fairness?from=2025-08-11&to=2025-08-11',
    ).set(staff('school_admin'));
    expect(fairness.status).toBe(200);
    expect(fairness.body.fairness).toEqual([
      { teacherMemberId: 'teacher-free', acceptedCount: 1 },
    ]);

    // Separate open cover for period 1 → mark uncovered
    const absence2 = await request(app).post('/api/timetable/t1/absences').set(staff('school_admin')).send({
      teacher_member_id: 'teacher-absent',
      date: '2025-08-11',
      period_indexes: [1],
      reason: 'sick',
    });
    const cover2 = absence2.body.covers[0].id as string;
    const uncovered = await request(app)
      .post(`/api/timetable/t1/cover/${cover2}/mark-uncovered`).set(staff('school_admin'))
      .send();
    expect(uncovered.status).toBe(200);
    expect(uncovered.body.cover.state).toBe('uncovered');
    expect(uncovered.body.instance.status).toBe('lost');
    expect(uncovered.body.instance.lostReason).toBe('teacher_absent_uncovered');
  });

  it('lists covers by date/state and isolates tenants', async () => {
    await request(app).post('/api/timetable/t1/absences').set(staff('school_admin')).send({
      teacher_member_id: 'teacher-absent',
      date: '2025-08-11',
      reason: 'sick',
    });

    const list = await request(app).get(
      '/api/timetable/t1/cover?date=2025-08-11&state=open',
    ).set(staff('school_admin'));
    expect(list.status).toBe(200);
    expect(list.body.covers.length).toBeGreaterThan(0);

    const other = await request(app).get(
      '/api/timetable/tenant-b/cover?date=2025-08-11',
    ).set(staff('school_admin'));
    expect(other.status).toBe(200);
    expect(other.body.covers).toHaveLength(0);
  });
});
