import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolTimetableApp } from '../src/index';
import type { SchoolTimetableSqlite } from '../src/db';

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
      label: 'Break',
      start_time: '09:45',
      end_time: '10:00',
      is_teaching: 0,
    },
    {
      index: 2,
      label: 'P2',
      start_time: '10:00',
      end_time: '10:45',
      is_teaching: 1,
    },
  ];
}

describe('school-timetable slots', () => {
  let app: Express;
  let db: SchoolTimetableSqlite;
  let daySchemeId: string;
  let sectionA: string;
  let sectionB: string;
  let allocMathA: string;
  let allocMathB: string;
  let allocSciA: string;

  beforeEach(async () => {
    const created = await createSchoolTimetableApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
    });
    app = created.app;
    db = created.db;

    const scheme = await request(app).post('/api/timetable/t1/day-schemes').set(staff('school_admin')).send({
      label: 'Weekly',
      kind: 'weekly',
      periods: periodsOk(),
    });
    daySchemeId = scheme.body.id;

    const secA = await request(app).post('/api/timetable/t1/sections').set(staff('school_admin')).send({
      academic_session_id: 'sess-1',
      class_label: '8',
      section: 'A',
      day_scheme_id: daySchemeId,
    });
    sectionA = secA.body.id;

    const secB = await request(app).post('/api/timetable/t1/sections').set(staff('school_admin')).send({
      academic_session_id: 'sess-1',
      class_label: '8',
      section: 'B',
      day_scheme_id: daySchemeId,
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

    const aMath = await request(app).post('/api/timetable/t1/allocations').set(staff('school_admin')).send({
      section_id: sectionA,
      subject_id: math.body.id,
      teacher_member_id: 'teacher-math',
      periods_per_week: 5,
    });
    allocMathA = aMath.body.id;

    const bMath = await request(app).post('/api/timetable/t1/allocations').set(staff('school_admin')).send({
      section_id: sectionB,
      subject_id: math.body.id,
      teacher_member_id: 'teacher-math',
      periods_per_week: 5,
    });
    allocMathB = bMath.body.id;

    const aSci = await request(app).post('/api/timetable/t1/allocations').set(staff('school_admin')).send({
      section_id: sectionA,
      subject_id: sci.body.id,
      teacher_member_id: 'teacher-sci',
      periods_per_week: 4,
    });
    allocSciA = aSci.body.id;
  });

  afterEach(async () => {
    await db.close();
  });

  it('replaces and reads section slots with subject/teacher join', async () => {
    const put = await request(app)
      .put(`/api/timetable/t1/sections/${sectionA}/slots`).set(staff('school_admin'))
      .send([
        { day_ref: 'mon', period_index: 0, allocation_id: allocMathA },
        { day_ref: 'mon', period_index: 2, allocation_id: allocSciA },
        { day_ref: 'tue', period_index: 0, allocation_id: allocMathA },
      ]);
    expect(put.status).toBe(200);
    expect(put.body.slots).toHaveLength(3);
    expect(put.body.slots[0].subjectCode).toBe('MATH');
    expect(put.body.slots[0].teacherMemberId).toBe('teacher-math');

    const got = await request(app).get(`/api/timetable/t1/sections/${sectionA}/slots`).set(staff('school_admin'));
    expect(got.status).toBe(200);
    expect(got.body.slots).toHaveLength(3);
  });

  it('rejects invalid day_ref, non-teaching period, duplicates, foreign allocation', async () => {
    const badDay = await request(app)
      .put(`/api/timetable/t1/sections/${sectionA}/slots`).set(staff('school_admin'))
      .send([{ day_ref: 'sun', period_index: 0, allocation_id: allocMathA }]);
    expect(badDay.status).toBe(400);
    expect(badDay.body.error).toMatch(/day_ref/i);

    const breakPeriod = await request(app)
      .put(`/api/timetable/t1/sections/${sectionA}/slots`).set(staff('school_admin'))
      .send([{ day_ref: 'mon', period_index: 1, allocation_id: allocMathA }]);
    expect(breakPeriod.status).toBe(400);
    expect(breakPeriod.body.error).toMatch(/teaching/i);

    const dup = await request(app)
      .put(`/api/timetable/t1/sections/${sectionA}/slots`).set(staff('school_admin'))
      .send([
        { day_ref: 'mon', period_index: 0, allocation_id: allocMathA },
        { day_ref: 'mon', period_index: 0, allocation_id: allocSciA },
      ]);
    expect(dup.status).toBe(400);
    expect(dup.body.error).toMatch(/duplicate/i);

    const foreign = await request(app)
      .put(`/api/timetable/t1/sections/${sectionA}/slots`).set(staff('school_admin'))
      .send([{ day_ref: 'mon', period_index: 0, allocation_id: allocMathB }]);
    expect(foreign.status).toBe(400);
    expect(foreign.body.error).toMatch(/allocation/i);
  });

  it('detects teacher clashes across sections in the same session', async () => {
    await request(app)
      .put(`/api/timetable/t1/sections/${sectionA}/slots`).set(staff('school_admin'))
      .send([{ day_ref: 'wed', period_index: 0, allocation_id: allocMathA }]);

    const clash = await request(app)
      .put(`/api/timetable/t1/sections/${sectionB}/slots`).set(staff('school_admin'))
      .send([{ day_ref: 'wed', period_index: 0, allocation_id: allocMathB }]);
    expect(clash.status).toBe(409);
    expect(clash.body.error).toBe('teacher clash');
    expect(clash.body.clashes).toHaveLength(1);
    expect(clash.body.clashes[0].teacherMemberId).toBe('teacher-math');
    expect(clash.body.clashes[0].conflictingSectionId).toBe(sectionA);
  });

  it('returns teacher week view', async () => {
    await request(app)
      .put(`/api/timetable/t1/sections/${sectionA}/slots`).set(staff('school_admin'))
      .send([
        { day_ref: 'mon', period_index: 0, allocation_id: allocMathA },
        { day_ref: 'tue', period_index: 2, allocation_id: allocSciA },
      ]);

    const week = await request(app).get('/api/timetable/t1/teachers/teacher-math/slots').set(staff('school_admin'));
    expect(week.status).toBe(200);
    expect(week.body.slots).toHaveLength(1);
    expect(week.body.slots[0].dayRef).toBe('mon');
    expect(week.body.slots[0].subjectCode).toBe('MATH');

    const sci = await request(app).get('/api/timetable/t1/teachers/teacher-sci/slots').set(staff('school_admin'));
    expect(sci.body.slots).toHaveLength(1);
  });

  it('isolates tenants', async () => {
    await request(app)
      .put(`/api/timetable/t1/sections/${sectionA}/slots`).set(staff('school_admin'))
      .send([{ day_ref: 'mon', period_index: 0, allocation_id: allocMathA }]);

    const other = await request(app).get(`/api/timetable/tenant-b/sections/${sectionA}/slots`).set(staff('school_admin'));
    expect(other.status).toBe(404);

    const teacherB = await request(app).get(
      '/api/timetable/tenant-b/teachers/teacher-math/slots',
    ).set(staff('school_admin'));
    expect(teacherB.status).toBe(200);
    expect(teacherB.body.slots).toHaveLength(0);
  });
});
