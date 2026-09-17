import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolAssessmentApp,
  assignRowMajorSeatCodes,
  type SchoolAssessmentSqlite,
} from '../src/index';

describe('assignRowMajorSeatCodes', () => {
  it('assigns unique row-major codes', () => {
    const codes = assignRowMajorSeatCodes(30);
    expect(codes).toHaveLength(30);
    expect(new Set(codes).size).toBe(30);
    expect(codes[0]).toBe('A1');
    expect(codes[7]).toBe('A8');
    expect(codes[8]).toBe('B1');
  });
});

describe('school-assessment exam sittings (Phase 4)', () => {
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
        course_ref: 'c1',
        section_ref: '8A',
        subject_code: 'Sc',
        class_label: '8',
        date: '2025-07-10',
        max_marks: 100,
        kind: 'summative',
      });
    examId = exam.body.id;
  });

  afterEach(async () => {
    await db.close();
  });

  function windowAroundNow(padMs = 60_000) {
    const start = new Date(Date.now() - padMs).toISOString();
    const end = new Date(Date.now() + padMs).toISOString();
    return { starts_on: start, ends_on: end };
  }

  async function createSitting(
    studentIds: string[],
    overrides: Record<string, unknown> = {},
  ) {
    return request(app)
      .post(`/api/assessment/t1/exams/${examId}/sittings`)
      .set(staff('school_admin'))
      .send({
        room_label: 'Hall A',
        ...windowAroundNow(),
        student_ids: studentIds,
        ...overrides,
      });
  }

  async function attachMcqPaper(opts?: {
    includeSubjective?: boolean;
    maxMarks?: number;
  }) {
    const includeSubjective = opts?.includeSubjective ?? false;
    const total = opts?.maxMarks ?? (includeSubjective ? 100 : 40);
    const mcqMarks = includeSubjective ? 40 : total;
    const saMarks = includeSubjective ? 60 : 0;

    const rules = includeSubjective
      ? [
          { bucket: 'objective', pct: 40 },
          { bucket: 'short_long', pct: 60 },
          { bucket: 'competency', pct: 0 },
        ]
      : [
          { bucket: 'objective', pct: 100 },
          { bucket: 'short_long', pct: 0 },
          { bucket: 'competency', pct: 0 },
        ];

    const bp = await request(app)
      .post('/api/assessment/t1/blueprints')
      .set(staff('school_admin'))
      .send({
        label: 'Sitting paper',
        class_label: '8',
        subject_code: 'Sc',
        total_marks: total,
        rules,
      });
    expect(bp.status).toBe(201);

    const q1 = await request(app)
      .post('/api/assessment/t1/questions')
      .set(staff('school_admin'))
      .send({
        subject_code: 'Sc',
        class_label: '8',
        kind: 'mcq',
        marks: mcqMarks / 2,
        body: { stem: 'Q1' },
        answer: { correct: 'A' },
      });
    const q2 = await request(app)
      .post('/api/assessment/t1/questions')
      .set(staff('school_admin'))
      .send({
        subject_code: 'Sc',
        class_label: '8',
        kind: 'mcq',
        marks: mcqMarks / 2,
        body: { stem: 'Q2' },
        answer: { correct: 'B' },
      });
    expect(q1.status).toBe(201);
    expect(q2.status).toBe(201);

    const questionIds = [q1.body.id, q2.body.id];
    if (includeSubjective) {
      const sa = await request(app)
        .post('/api/assessment/t1/questions')
        .set(staff('school_admin'))
        .send({
          subject_code: 'Sc',
          class_label: '8',
          kind: 'sa',
          marks: saMarks,
          body: { stem: 'Explain' },
          answer: { rubric: 'open' },
        });
      expect(sa.status).toBe(201);
      questionIds.push(sa.body.id);
    }

    const paper = await request(app)
      .post('/api/assessment/t1/papers')
      .set(staff('school_admin'))
      .send({
        blueprint_id: bp.body.id,
        question_ids: questionIds,
        exam_ref: examId,
      });
    expect(paper.status).toBe(201);
    return {
      paperId: paper.body.id as string,
      q1Id: q1.body.id as string,
      q2Id: q2.body.id as string,
      mcqMarks,
    };
  }

  it('30 students get unique seat codes; duplicate student → 400', async () => {
    const studentIds = Array.from({ length: 30 }, (_, i) => `s${i + 1}`);
    const created = await createSitting(studentIds);
    expect(created.status).toBe(201);
    expect(created.body.seats).toHaveLength(30);
    const codes = created.body.seats.map((s: { seatCode: string }) => s.seatCode);
    expect(new Set(codes).size).toBe(30);

    const dup = await createSitting(['s1', 's1']);
    expect(dup.status).toBe(400);
    expect(dup.body.error).toMatch(/duplicate/i);
  });

  it('unique ticket per exam+student; re-issue → 409', async () => {
    const created = await createSitting(['s1', 's2']);
    const sittingId = created.body.sitting.id as string;

    const issued = await request(app)
      .post(`/api/assessment/t1/sittings/${sittingId}/issue-tickets`)
      .set(staff('school_admin'));
    expect(issued.status).toBe(201);
    expect(issued.body.tickets).toHaveLength(2);
    const codes = issued.body.tickets.map((t: { ticketCode: string }) => t.ticketCode);
    expect(new Set(codes).size).toBe(2);

    const again = await request(app)
      .post(`/api/assessment/t1/sittings/${sittingId}/issue-tickets`)
      .set(staff('school_admin'));
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('ticket_already_issued');
  });

  it('tenant isolation on sittings and tickets', async () => {
    const created = await createSitting(['s1']);
    const sittingId = created.body.sitting.id as string;
    await request(app)
      .post(`/api/assessment/t1/sittings/${sittingId}/issue-tickets`)
      .set(staff('school_admin'));

    const otherList = await request(app)
      .get(`/api/assessment/t2/exams/${examId}/sittings`)
      .set(staff('school_admin'));
    expect(otherList.status).toBe(404);

    const otherTickets = await request(app)
      .get(`/api/assessment/t2/sittings/${sittingId}/tickets`)
      .set(staff('school_admin'));
    expect(otherTickets.status).toBe(404);

    const otherIssue = await request(app)
      .post(`/api/assessment/t2/sittings/${sittingId}/issue-tickets`)
      .set(staff('school_admin'));
    expect(otherIssue.status).toBe(404);
  });

  it('print tickets include seat/room/exam, never marks', async () => {
    const created = await createSitting(['s1']);
    const sittingId = created.body.sitting.id as string;
    await request(app)
      .post(`/api/assessment/t1/sittings/${sittingId}/issue-tickets`)
      .set(staff('school_admin'));

    const tickets = await request(app)
      .get(`/api/assessment/t1/sittings/${sittingId}/tickets`)
      .set(staff('teacher'));
    expect(tickets.status).toBe(200);
    expect(tickets.body.tickets).toHaveLength(1);
    const t = tickets.body.tickets[0];
    expect(t.studentId).toBe('s1');
    expect(t.roomLabel).toBe('Hall A');
    expect(t.seatCode).toBe('A1');
    expect(t.examId).toBe(examId);
    expect(t.examDate).toBe('2025-07-10');
    expect(JSON.stringify(t)).not.toMatch(/draft|assigned|marks/i);
  });

  it('start before window → 400; during → 201; submit after → 409', async () => {
    await attachMcqPaper();

    const future = await createSitting(['s1'], {
      starts_on: new Date(Date.now() + 3600_000).toISOString(),
      ends_on: new Date(Date.now() + 7200_000).toISOString(),
    });
    const futureId = future.body.sitting.id as string;
    const early = await request(app)
      .post(`/api/assessment/t1/sittings/${futureId}/attempts/start`)
      .set(staff('teacher'))
      .send({ student_id: 's1' });
    expect(early.status).toBe(400);
    expect(early.body.error).toBe('sitting_not_open');

    const open = await createSitting(['s1']);
    const sittingId = open.body.sitting.id as string;
    await request(app)
      .post(`/api/assessment/t1/sittings/${sittingId}/open`)
      .set(staff('school_admin'));

    const started = await request(app)
      .post(`/api/assessment/t1/sittings/${sittingId}/attempts/start`)
      .set(staff('teacher'))
      .send({ student_id: 's1' });
    expect(started.status).toBe(201);
    expect(started.body.status).toBe('in_progress');
    const attemptId = started.body.id as string;

    await db.run(
      `UPDATE exam_sittings SET ends_on = ? WHERE id = ?`,
      [new Date(Date.now() - 1000).toISOString(), sittingId],
    );

    const late = await request(app)
      .post(`/api/assessment/t1/attempts/${attemptId}/submit`)
      .set(staff('teacher'));
    expect(late.status).toBe(409);
    expect(late.body.error).toBe('sitting_closed');
  });

  it('MCQ scores become drafts; subjective does not invent marks', async () => {
    const { q1Id, q2Id, mcqMarks } = await attachMcqPaper({
      includeSubjective: true,
      maxMarks: 100,
    });

    // exam max_marks is 100 — draft should be MCQ portion only
    const created = await createSitting(['s1']);
    const sittingId = created.body.sitting.id as string;

    const started = await request(app)
      .post(`/api/assessment/t1/sittings/${sittingId}/attempts/start`)
      .set(staff('teacher'))
      .send({ student_id: 's1' });
    expect(started.status).toBe(201);
    const attemptId = started.body.id as string;

    await request(app)
      .put(`/api/assessment/t1/attempts/${attemptId}/answers`)
      .set(staff('teacher'))
      .send({
        answers: {
          [q1Id]: 'A',
          [q2Id]: 'Z',
        },
      });

    const submitted = await request(app)
      .post(`/api/assessment/t1/attempts/${attemptId}/submit`)
      .set(staff('teacher'));
    expect(submitted.status).toBe(200);
    expect(submitted.body.draft_marks).toBe(mcqMarks / 2);

    const marks = await request(app)
      .get(`/api/assessment/t1/exams/${examId}/marks`)
      .set(staff('school_admin'));
    expect(marks.status).toBe(200);
    const row = marks.body.marks.find((m: { studentId: string }) => m.studentId === 's1');
    expect(row.draftMarks).toBe(mcqMarks / 2);
    expect(row.assignedMarks).toBeNull();
  });

  it('subjective-only paper leaves no auto draft', async () => {
    const bp = await request(app)
      .post('/api/assessment/t1/blueprints')
      .set(staff('school_admin'))
      .send({
        label: 'Essay only',
        class_label: '8',
        subject_code: 'Sc',
        total_marks: 100,
        rules: [
          { bucket: 'short_long', pct: 100 },
          { bucket: 'objective', pct: 0 },
          { bucket: 'competency', pct: 0 },
        ],
      });
    const sa = await request(app)
      .post('/api/assessment/t1/questions')
      .set(staff('school_admin'))
      .send({
        subject_code: 'Sc',
        class_label: '8',
        kind: 'sa',
        marks: 100,
        body: { stem: 'Essay' },
      });
    const paper = await request(app)
      .post('/api/assessment/t1/papers')
      .set(staff('school_admin'))
      .send({
        blueprint_id: bp.body.id,
        question_ids: [sa.body.id],
        exam_ref: examId,
      });
    expect(paper.status).toBe(201);

    const created = await createSitting(['s1']);
    const sittingId = created.body.sitting.id as string;
    const started = await request(app)
      .post(`/api/assessment/t1/sittings/${sittingId}/attempts/start`)
      .set(staff('teacher'))
      .send({ student_id: 's1' });
    await request(app)
      .put(`/api/assessment/t1/attempts/${started.body.id}/answers`)
      .set(staff('teacher'))
      .send({ answers: { [sa.body.id]: 'long text' } });
    const submitted = await request(app)
      .post(`/api/assessment/t1/attempts/${started.body.id}/submit`)
      .set(staff('teacher'));
    expect(submitted.status).toBe(200);
    expect(submitted.body.draft_marks).toBeNull();

    const marks = await request(app)
      .get(`/api/assessment/t1/exams/${examId}/marks`)
      .set(staff('school_admin'));
    expect(marks.body.marks).toHaveLength(0);
  });

  it('GET paper by exam_ref', async () => {
    const { paperId } = await attachMcqPaper();
    const got = await request(app)
      .get(`/api/assessment/t1/exams/${examId}/paper`)
      .set(staff('teacher'));
    expect(got.status).toBe(200);
    expect(got.body.id).toBe(paperId);
  });
});
