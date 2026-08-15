import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
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
      label: 'P2',
      start_time: '09:45',
      end_time: '10:30',
      is_teaching: 1,
    },
  ];
}

describe('school-timetable allocations', () => {
  let app: Express;
  let db: SchoolTimetableSqlite;
  let daySchemeId: string;

  beforeEach(async () => {
    const created = await createSchoolTimetableApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
    });
    app = created.app;
    db = created.db;

    const scheme = await request(app).post('/api/timetable/t1/day-schemes').send({
      label: 'Weekly',
      kind: 'weekly',
      periods: periodsOk(),
    });
    daySchemeId = scheme.body.id;
  });

  afterEach(async () => {
    await db.close();
  });

  async function createSection(tenant = 't1', overrides: Record<string, unknown> = {}) {
    const res = await request(app)
      .post(`/api/timetable/${tenant}/sections`)
      .send({
        academic_session_id: 'sess-1',
        class_label: '8',
        section: 'A',
        day_scheme_id: daySchemeId,
        class_teacher_member_id: 'teacher-ct',
        ...overrides,
      });
    return res;
  }

  async function createSubject(tenant = 't1', overrides: Record<string, unknown> = {}) {
    return request(app)
      .post(`/api/timetable/${tenant}/subjects`)
      .send({
        code: 'MATH',
        label: 'Mathematics',
        is_elective: false,
        ...overrides,
      });
  }

  it('CRUD sections, subjects, allocations', async () => {
    const section = await createSection();
    expect(section.status).toBe(201);
    expect(section.body.classLabel).toBe('8');
    expect(section.body.section).toBe('A');

    const sectionList = await request(app).get('/api/timetable/t1/sections');
    expect(sectionList.body.sections).toHaveLength(1);

    const patchedSection = await request(app)
      .patch(`/api/timetable/t1/sections/${section.body.id}`)
      .send({ class_teacher_member_id: 'teacher-ct-2' });
    expect(patchedSection.status).toBe(200);
    expect(patchedSection.body.classTeacherMemberId).toBe('teacher-ct-2');

    const subject = await createSubject();
    expect(subject.status).toBe(201);
    expect(subject.body.code).toBe('MATH');

    const subjectList = await request(app).get('/api/timetable/t1/subjects');
    expect(subjectList.body.subjects).toHaveLength(1);

    const allocation = await request(app).post('/api/timetable/t1/allocations').send({
      section_id: section.body.id,
      subject_id: subject.body.id,
      teacher_member_id: 'teacher-math',
      periods_per_week: 5,
      room: 'R101',
    });
    expect(allocation.status).toBe(201);
    expect(allocation.body.periodsPerWeek).toBe(5);
    expect(allocation.body.room).toBe('R101');

    const allocList = await request(app).get('/api/timetable/t1/allocations');
    expect(allocList.body.allocations).toHaveLength(1);

    const patchedAlloc = await request(app)
      .patch(`/api/timetable/t1/allocations/${allocation.body.id}`)
      .send({ room: 'R102' });
    expect(patchedAlloc.status).toBe(200);
    expect(patchedAlloc.body.room).toBe('R102');

    await request(app).delete(`/api/timetable/t1/allocations/${allocation.body.id}`);
    await request(app).delete(`/api/timetable/t1/subjects/${subject.body.id}`);
    await request(app).delete(`/api/timetable/t1/sections/${section.body.id}`);
    expect((await request(app).get('/api/timetable/t1/sections')).body.sections).toHaveLength(0);
  });

  it('enforces subject code uniqueness and section/subject allocation uniqueness', async () => {
    const subject = await createSubject();
    expect(subject.status).toBe(201);

    const dupCode = await createSubject('t1', { code: 'MATH', label: 'Other Math' });
    expect(dupCode.status).toBe(409);

    const section = await createSection();
    const alloc = await request(app).post('/api/timetable/t1/allocations').send({
      section_id: section.body.id,
      subject_id: subject.body.id,
      teacher_member_id: 't1',
      periods_per_week: 4,
    });
    expect(alloc.status).toBe(201);

    const dupAlloc = await request(app).post('/api/timetable/t1/allocations').send({
      section_id: section.body.id,
      subject_id: subject.body.id,
      teacher_member_id: 't2',
      periods_per_week: 3,
    });
    expect(dupAlloc.status).toBe(409);
  });

  it('blocks deleting a subject that has allocations', async () => {
    const section = await createSection();
    const subject = await createSubject();
    await request(app).post('/api/timetable/t1/allocations').send({
      section_id: section.body.id,
      subject_id: subject.body.id,
      teacher_member_id: 't1',
      periods_per_week: 2,
    });

    const del = await request(app).delete(`/api/timetable/t1/subjects/${subject.body.id}`);
    expect(del.status).toBe(409);
    expect(del.body.error).toMatch(/allocations/i);
  });

  it('isolates tenants', async () => {
    const schemeA = await request(app).post('/api/timetable/tenant-a/day-schemes').send({
      label: 'Weekly A',
      kind: 'weekly',
      periods: periodsOk(),
    });
    const schemeB = await request(app).post('/api/timetable/tenant-b/day-schemes').send({
      label: 'Weekly B',
      kind: 'weekly',
      periods: periodsOk(),
    });

    await createSection('tenant-a', { day_scheme_id: schemeA.body.id });
    await createSubject('tenant-a');

    const bSections = await request(app).get('/api/timetable/tenant-b/sections');
    expect(bSections.body.sections).toHaveLength(0);
    const bSubjects = await request(app).get('/api/timetable/tenant-b/subjects');
    expect(bSubjects.body.subjects).toHaveLength(0);

    const sectionB = await request(app).post('/api/timetable/tenant-b/sections').send({
      academic_session_id: 'sess-1',
      class_label: '8',
      section: 'A',
      day_scheme_id: schemeB.body.id,
    });
    expect(sectionB.status).toBe(201);

    const aSections = await request(app).get('/api/timetable/tenant-a/sections');
    expect(aSections.body.sections).toHaveLength(1);
  });
});
