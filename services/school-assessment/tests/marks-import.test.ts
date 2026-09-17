import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolAssessmentApp,
  type SchoolAssessmentSqlite,
} from '../src/index';

describe('school-assessment marks import + lock (Phase 2)', () => {
  let app: Express;
  let db: SchoolAssessmentSqlite;
  let examId: string;

  beforeEach(async () => {
    const created = await createSchoolAssessmentApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
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
        ends_on: '2025-07-15',
        weightage_pct: 20,
      });
    const exam = await request(app)
      .post('/api/assessment/t1/exams')
      .set(staff('school_admin'))
      .send({
        exam_term_id: term.body.id,
        course_ref: 'course-1',
        section_ref: '8A',
        subject_code: 'Sc',
        class_label: '8',
        date: '2025-07-10',
        max_marks: 40,
        kind: 'formative',
      });
    examId = exam.body.id;
  });

  afterEach(async () => {
    await db.close();
  });

  it('import valid rows as drafts only', async () => {
    const res = await request(app)
      .post(`/api/assessment/t1/exams/${examId}/marks/import`)
      .set(staff('school_admin'))
      .send({
        entered_by: 'tchr-1',
        rows: [
          { student_id: 's1', draft_marks: 30 },
          { student_id: 's2', is_absent: true },
          { student_id: 's3', is_exempt: true },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.marks).toHaveLength(3);
    expect(res.body.marks.every((m: { assignedMarks: unknown }) => m.assignedMarks == null)).toBe(
      true,
    );
  });

  it('import atomic failure names line; zero writes', async () => {
    await request(app)
      .post(`/api/assessment/t1/exams/${examId}/marks/import`)
      .set(staff('school_admin'))
      .send({
        entered_by: 'tchr-1',
        rows: [{ student_id: 's1', draft_marks: 10 }],
      });

    const fail = await request(app)
      .post(`/api/assessment/t1/exams/${examId}/marks/import`)
      .set(staff('school_admin'))
      .send({
        entered_by: 'tchr-1',
        rows: [
          { student_id: 's2', draft_marks: 20 },
          { student_id: 's3', draft_marks: 99 },
        ],
      });
    expect(fail.status).toBe(400);
    expect(fail.body.error).toBe('import_validation_failed');
    expect(fail.body.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ line: 2, student_id: 's3' }),
      ]),
    );

    const listed = await request(app)
      .get(`/api/assessment/t1/exams/${examId}/marks`)
      .set(staff('school_admin'));
    expect(listed.body.marks).toHaveLength(1);
    expect(listed.body.marks[0].studentId).toBe('s1');
  });

  it('tenant isolation on import', async () => {
    const other = await request(app)
      .post(`/api/assessment/t2/exams/${examId}/marks/import`)
      .set(staff('school_admin'))
      .send({
        entered_by: 'tchr',
        rows: [{ student_id: 's1', draft_marks: 10 }],
      });
    expect(other.status).toBe(404);
  });

  it('lock blocks PUT; unlock with reason then allows', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    await request(app)
      .patch(`/api/assessment/t1/exams/${examId}`)
      .set(staff('school_admin'))
      .send({ entry_closes_at: past });

    const locked = await request(app)
      .put(`/api/assessment/t1/exams/${examId}/marks`)
      .set(staff('school_admin'))
      .send({
        entered_by: 'tchr-1',
        marks: [{ student_id: 's1', draft_marks: 20 }],
      });
    expect(locked.status).toBe(409);
    expect(locked.body.error).toBe('marks_locked');

    const noReason = await request(app)
      .post(`/api/assessment/t1/exams/${examId}/unlock`)
      .set(staff('school_admin'))
      .send({ unlocked_by: 'admin' });
    expect(noReason.status).toBe(400);

    const unlock = await request(app)
      .post(`/api/assessment/t1/exams/${examId}/unlock`)
      .set(staff('school_admin'))
      .send({ unlocked_by: 'admin', reason: 'late scripts' });
    expect(unlock.status).toBe(200);
    expect(unlock.body.entryClosesAt).toBeNull();

    const ok = await request(app)
      .put(`/api/assessment/t1/exams/${examId}/marks`)
      .set(staff('school_admin'))
      .send({
        entered_by: 'tchr-1',
        marks: [{ student_id: 's1', draft_marks: 20 }],
      });
    expect(ok.status).toBe(200);
  });
});
