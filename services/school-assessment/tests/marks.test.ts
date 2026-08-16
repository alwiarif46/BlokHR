import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolAssessmentApp,
  type DomainEvent,
  type EventPublisher,
  type SchoolAssessmentSqlite,
} from '../src/index';

describe('school-assessment marks (P4-02)', () => {
  let app: Express;
  let db: SchoolAssessmentSqlite;
  let examId: string;
  let events: DomainEvent[];
  let publisher: EventPublisher;

  beforeEach(async () => {
    events = [];
    publisher = {
      publish: async (e) => {
        events.push(e);
      },
    };
    const created = await createSchoolAssessmentApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      eventPublisher: publisher,
    });
    app = created.app;
    db = created.db;

    const term = await request(app).post('/api/assessment/t1/exam-terms').set(staff('school_admin')).send({
      academic_session_id: 'ay-2025',
      label: 'PT1',
      starts_on: '2025-07-01',
      ends_on: '2025-07-15',
      weightage_pct: 20,
    });
    const exam = await request(app).post('/api/assessment/t1/exams').set(staff('school_admin')).send({
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

  it('bulk entry validation: range, exclusive flags, reject assigned write', async () => {
    const over = await request(app).put(`/api/assessment/t1/exams/${examId}/marks`).set(staff('school_admin')).send({
      entered_by: 'tchr-1',
      marks: [{ student_id: 's1', draft_marks: 41 }],
    });
    expect(over.status).toBe(400);

    const both = await request(app).put(`/api/assessment/t1/exams/${examId}/marks`).set(staff('school_admin')).send({
      entered_by: 'tchr-1',
      marks: [{ student_id: 's1', draft_marks: 10, is_absent: true }],
    });
    expect(both.status).toBe(400);

    const direct = await request(app).put(`/api/assessment/t1/exams/${examId}/marks`).set(staff('school_admin')).send({
      entered_by: 'tchr-1',
      marks: [{ student_id: 's1', assigned_marks: 10 }],
    });
    expect(direct.status).toBe(400);
    expect(direct.body.error).toMatch(/assigned_marks/);

    const ok = await request(app).put(`/api/assessment/t1/exams/${examId}/marks`).set(staff('school_admin')).send({
      entered_by: 'tchr-1',
      marks: [
        { student_id: 's1', draft_marks: 30 },
        { student_id: 's2', is_absent: true },
        { student_id: 's3', is_exempt: true },
      ],
    });
    expect(ok.status).toBe(200);
    expect(ok.body.marks).toHaveLength(3);
    expect(ok.body.marks.find((m: { studentId: string }) => m.studentId === 's1').draftMarks).toBe(
      30,
    );
    expect(ok.body.marks.find((m: { studentId: string }) => m.studentId === 's1').assignedMarks).toBeNull();
  });

  it('atomic publish fails listing missing students; then publishes with event', async () => {
    await request(app).put(`/api/assessment/t1/exams/${examId}/marks`).set(staff('school_admin')).send({
      entered_by: 'tchr-1',
      marks: [
        { student_id: 's1', draft_marks: 30 },
        { student_id: 's2' },
        { student_id: 's3', is_absent: true },
      ],
    });

    const fail = await request(app)
      .post(`/api/assessment/t1/exams/${examId}/publish`).set(staff('school_admin'))
      .send({ published_by: 'coord-1' });
    expect(fail.status).toBe(400);
    expect(fail.body.student_ids).toEqual(['s2']);

    const still = await request(app).get(`/api/assessment/t1/exams/${examId}/marks`).set(staff('school_admin'));
    expect(still.body.marks.every((m: { assignedMarks: number | null }) => m.assignedMarks == null)).toBe(
      true,
    );
    expect(events).toHaveLength(0);

    await request(app).put(`/api/assessment/t1/exams/${examId}/marks`).set(staff('school_admin')).send({
      entered_by: 'tchr-1',
      marks: [{ student_id: 's2', draft_marks: 20 }],
    });

    const pub = await request(app)
      .post(`/api/assessment/t1/exams/${examId}/publish`).set(staff('school_admin'))
      .send({ published_by: 'coord-1' });
    expect(pub.status).toBe(200);
    expect(pub.body.count).toBe(3);
    expect(
      pub.body.marks.find((m: { studentId: string }) => m.studentId === 's1').assignedMarks,
    ).toBe(30);
    expect(
      pub.body.marks.find((m: { studentId: string }) => m.studentId === 's3').assignedMarks,
    ).toBeNull();

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('school.marks.published');
    expect(events[0]!.data.exam_id).toBe(examId);
    expect(events[0]!.data.count).toBe(3);
  });

  it('moderation + audit; stats exclude exempt', async () => {
    await request(app).put(`/api/assessment/t1/exams/${examId}/marks`).set(staff('school_admin')).send({
      entered_by: 'tchr-1',
      marks: [
        { student_id: 's1', draft_marks: 40 },
        { student_id: 's2', draft_marks: 20 },
        { student_id: 's3', is_exempt: true },
        { student_id: 's4', is_absent: true },
      ],
    });
    await request(app)
      .post(`/api/assessment/t1/exams/${examId}/publish`).set(staff('school_admin'))
      .send({ published_by: 'coord-1' });

    const listed = await request(app).get(`/api/assessment/t1/exams/${examId}/marks`).set(staff('school_admin'));
    expect(listed.status).toBe(200);
    expect(listed.body.stats.mean).toBe(30);
    expect(listed.body.stats.median).toBe(30);
    expect(listed.body.stats.high).toBe(40);
    expect(listed.body.stats.low).toBe(20);
    expect(listed.body.stats.absentCount).toBe(1);
    expect(
      listed.body.marks.find((m: { studentId: string }) => m.studentId === 's1').pct,
    ).toBe(100);

    const s1 = listed.body.marks.find((m: { studentId: string }) => m.studentId === 's1');
    const mod = await request(app)
      .post(`/api/assessment/t1/marks/${s1.id}/moderate`).set(staff('school_admin'))
      .send({ assigned_marks: 36, moderated_by: 'hod-1', reason: 'recheck' });
    expect(mod.status).toBe(200);
    expect(mod.body.mark.assignedMarks).toBe(36);
    expect(mod.body.audit.previousAssigned).toBe(40);
    expect(mod.body.audit.reason).toBe('recheck');

    const auditRows = await db.all<{ reason: string }>(
      'SELECT reason FROM marks_audit WHERE mark_id = ?',
      [s1.id],
    );
    expect(auditRows).toHaveLength(1);

    // draft still editable after publish
    const draftEdit = await request(app).put(`/api/assessment/t1/exams/${examId}/marks`).set(staff('school_admin')).send({
      entered_by: 'tchr-1',
      marks: [{ student_id: 's2', draft_marks: 22 }],
    });
    expect(draftEdit.status).toBe(200);
    expect(draftEdit.body.marks[0].draftMarks).toBe(22);
    expect(draftEdit.body.marks[0].assignedMarks).toBe(20);
  });

  it('tenant isolation', async () => {
    await request(app).put(`/api/assessment/t1/exams/${examId}/marks`).set(staff('school_admin')).send({
      entered_by: 'tchr-1',
      marks: [{ student_id: 's1', draft_marks: 10 }],
    });
    const other = await request(app).get(`/api/assessment/t2/exams/${examId}/marks`).set(staff('school_admin'));
    expect(other.status).toBe(404);
  });
});
