import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolAssessmentApp } from '../src/index';
import type { SchoolAssessmentSqlite } from '../src/db';
import { StubTimetableClient } from '../src/clients/timetable-client';
import { staff } from './helpers/auth';

describe('school-assessment L5 teacher scope (P12-05)', () => {
  let app: Express;
  let db: SchoolAssessmentSqlite;
  let timetable: StubTimetableClient;
  let exam8A: string;
  let exam8B: string;

  beforeEach(async () => {
    timetable = new StubTimetableClient();
    const created = await createSchoolAssessmentApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      timetableClient: timetable,
    });
    app = created.app;
    db = created.db;

    const term = await request(app)
      .post('/api/assessment/t1/exam-terms')
      .set(staff('school_admin'))
      .send({
        academic_session_id: 'ay-2025',
        label: 'PT1',
        starts_on: '2025-07-01',
        ends_on: '2025-09-30',
        weightage_pct: 20,
      });
    expect(term.status).toBe(201);
    const a = await request(app)
      .post('/api/assessment/t1/exams')
      .set(staff('school_admin'))
      .send({
        exam_term_id: term.body.id,
        course_ref: 'c1',
        section_ref: '8A',
        subject_code: 'M',
        class_label: '8',
        date: '2025-09-15',
        max_marks: 40,
        kind: 'formative',
      });
    expect(a.status).toBe(201);
    const b = await request(app)
      .post('/api/assessment/t1/exams')
      .set(staff('school_admin'))
      .send({
        exam_term_id: term.body.id,
        course_ref: 'c1',
        section_ref: '8B',
        subject_code: 'M',
        class_label: '8',
        date: '2025-09-16',
        max_marks: 40,
        kind: 'formative',
      });
    expect(b.status).toBe(201);
    exam8A = a.body.id;
    exam8B = b.body.id;
  });

  afterEach(async () => {
    await db.close();
  });

  it('marks use stored exam section_ref; forged body section ignored', async () => {
    timetable.allowed = true;
    const ok = await request(app)
      .put(`/api/assessment/t1/exams/${exam8A}/marks`)
      .set(staff('teacher', 'member-teacher-1'))
      .send({
        entered_by: 'member-teacher-1',
        section_ref: '8B',
        marks: [{ student_id: 's1', draft_marks: 10 }],
      });
    expect(ok.status).not.toBe(403);
    expect(timetable.calls[0].sectionRef).toBe('8A');

    timetable.allowed = false;
    const denied = await request(app)
      .put(`/api/assessment/t1/exams/${exam8B}/marks`)
      .set(staff('teacher', 'member-teacher-1'))
      .send({
        entered_by: 'member-teacher-1',
        section_ref: '8A',
        marks: [{ student_id: 's1', draft_marks: 10 }],
      });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe('scope_denied');
    expect(timetable.calls.at(-1)!.sectionRef).toBe('8B');
  });

  it('HPC inputs resolve section from activity exam; timetable down ⇒ scope_unverifiable; admin bypass', async () => {
    const comps = await request(app)
      .get('/api/assessment/t1/hpc/competencies')
      .set(staff('school_admin'));
    const foundational = comps.body.competencies.find(
      (c: { stage: string }) => c.stage === 'foundational',
    );

    timetable.allowed = true;
    const ok = await request(app)
      .post('/api/assessment/t1/hpc/inputs')
      .set(staff('teacher', 'member-teacher-1'))
      .send({
        student_id: 's1',
        competency_id: foundational.id,
        activity_ref: exam8A,
        section_ref: '8B',
        source: 'teacher',
        level: 'beginner',
        recorded_by: 'member-teacher-1',
        academic_session_ref: 'ay-2025',
      });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(timetable.calls[0].sectionRef).toBe('8A');

    timetable.unverifiable = true;
    const down = await request(app)
      .post('/api/assessment/t1/hpc/inputs')
      .set(staff('teacher', 'member-teacher-1'))
      .send({
        student_id: 's1',
        competency_id: foundational.id,
        activity_ref: exam8A,
        source: 'teacher',
        level: 'proficient',
        recorded_by: 'member-teacher-1',
      });
    expect(down.status).toBe(403);
    expect(down.body.error).toBe('scope_unverifiable');

    const before = timetable.calls.length;
    timetable.unverifiable = false;
    timetable.allowed = false;
    const admin = await request(app)
      .post('/api/assessment/t1/hpc/inputs')
      .set(staff('school_admin'))
      .send({
        student_id: 's2',
        competency_id: foundational.id,
        source: 'teacher',
        level: 'advanced',
        recorded_by: 'admin',
      });
    expect(admin.status).toBe(201);
    expect(timetable.calls.length).toBe(before);
  });
});
