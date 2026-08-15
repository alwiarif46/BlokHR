import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolAssessmentApp,
  type SchoolAssessmentSqlite,
} from '../src/index';

describe('school-assessment exams (P4-01)', () => {
  let app: Express;
  let db: SchoolAssessmentSqlite;

  beforeEach(async () => {
    const created = await createSchoolAssessmentApp({
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

  it('health ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('exam term and exam CRUD', async () => {
    const term = await request(app).post('/api/assessment/t1/exam-terms').send({
      academic_session_id: 'ay-2025',
      label: 'PT1',
      starts_on: '2025-07-01',
      ends_on: '2025-07-15',
      weightage_pct: 20,
    });
    expect(term.status).toBe(201);
    expect(term.body.label).toBe('PT1');
    expect(term.body.weightagePct).toBe(20);

    const listed = await request(app).get(
      '/api/assessment/t1/exam-terms?academic_session_id=ay-2025',
    );
    expect(listed.body.terms).toHaveLength(1);

    const patched = await request(app)
      .patch(`/api/assessment/t1/exam-terms/${term.body.id}`)
      .send({ weightage_pct: 25 });
    expect(patched.status).toBe(200);
    expect(patched.body.weightagePct).toBe(25);

    const exam = await request(app).post('/api/assessment/t1/exams').send({
      exam_term_id: term.body.id,
      course_ref: 'course-1',
      section_ref: '8A',
      subject_code: 'Sc',
      class_label: '8',
      date: '2025-07-10',
      max_marks: 40,
      kind: 'formative',
    });
    expect(exam.status).toBe(201);
    expect(exam.body.maxMarks).toBe(40);
    expect(exam.body.kind).toBe('formative');

    const examPatch = await request(app)
      .patch(`/api/assessment/t1/exams/${exam.body.id}`)
      .send({ max_marks: 50, kind: 'summative' });
    expect(examPatch.status).toBe(200);
    expect(examPatch.body.maxMarks).toBe(50);
    expect(examPatch.body.kind).toBe('summative');

    const exams = await request(app).get(
      `/api/assessment/t1/exams?exam_term_id=${term.body.id}`,
    );
    expect(exams.body.exams).toHaveLength(1);

    const delExam = await request(app).delete(`/api/assessment/t1/exams/${exam.body.id}`);
    expect(delExam.status).toBe(204);

    const delTerm = await request(app).delete(
      `/api/assessment/t1/exam-terms/${term.body.id}`,
    );
    expect(delTerm.status).toBe(204);
  });

  it('enforces session weightage_pct sum ≤ 100', async () => {
    const a = await request(app).post('/api/assessment/t1/exam-terms').send({
      academic_session_id: 'ay-2025',
      label: 'PT1',
      starts_on: '2025-07-01',
      ends_on: '2025-07-15',
      weightage_pct: 60,
    });
    expect(a.status).toBe(201);

    const b = await request(app).post('/api/assessment/t1/exam-terms').send({
      academic_session_id: 'ay-2025',
      label: 'HY',
      starts_on: '2025-09-01',
      ends_on: '2025-09-15',
      weightage_pct: 50,
    });
    expect(b.status).toBe(400);
    expect(b.body.error).toMatch(/weightage/i);

    const ok = await request(app).post('/api/assessment/t1/exam-terms').send({
      academic_session_id: 'ay-2025',
      label: 'HY',
      starts_on: '2025-09-01',
      ends_on: '2025-09-15',
      weightage_pct: 40,
    });
    expect(ok.status).toBe(201);

    const breachPatch = await request(app)
      .patch(`/api/assessment/t1/exam-terms/${ok.body.id}`)
      .send({ weightage_pct: 50 });
    expect(breachPatch.status).toBe(400);
  });

  it('tenant isolation', async () => {
    const term = await request(app).post('/api/assessment/t1/exam-terms').send({
      academic_session_id: 'ay-2025',
      label: 'Annual',
      starts_on: '2026-02-01',
      ends_on: '2026-03-15',
      weightage_pct: 50,
    });
    const exam = await request(app).post('/api/assessment/t1/exams').send({
      exam_term_id: term.body.id,
      course_ref: 'c1',
      section_ref: '8A',
      subject_code: 'M',
      class_label: '8',
      date: '2026-02-10',
      max_marks: 80,
      kind: 'summative',
    });

    expect((await request(app).get(`/api/assessment/t2/exam-terms/${term.body.id}`)).status).toBe(
      404,
    );
    expect((await request(app).get(`/api/assessment/t2/exams/${exam.body.id}`)).status).toBe(
      404,
    );
  });
});
