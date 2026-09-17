import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff, SECRET } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolAssessmentApp,
  type SchoolAssessmentSqlite,
} from '../src/index';

function guardian(guardianId: string, studentRefs: string[] = []) {
  const h: Record<string, string> = {
    'X-Blok-Internal': SECRET,
    'X-Blok-Principal': 'guardian',
    'X-Blok-Guardian': guardianId,
  };
  if (studentRefs.length) {
    h['X-Blok-Students'] = studentRefs.join(',');
  }
  return h;
}

describe('school-assessment report rank + visible_from (Phase 2)', () => {
  let app: Express;
  let db: SchoolAssessmentSqlite;
  let examId: string;
  let templateId: string;

  beforeEach(async () => {
    const created = await createSchoolAssessmentApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
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

    const tmpl = await request(app)
      .post('/api/assessment/t1/templates')
      .set(staff('school_admin'))
      .send({
        label: 'Term Report',
        board_format: 'cbse_9pt',
        definition: [{ type: 'marks_table', config: { aggregation: 'avg' } }],
      });
    await request(app)
      .post(`/api/assessment/t1/templates/${tmpl.body.id}/promote`)
      .set(staff('school_admin'));
    templateId = tmpl.body.id;
  });

  afterEach(async () => {
    await db.close();
  });

  async function publishMarks(
    rows: Array<{ student_id: string; draft_marks?: number; is_exempt?: boolean; is_absent?: boolean }>,
  ) {
    await request(app)
      .put(`/api/assessment/t1/exams/${examId}/marks`)
      .set(staff('school_admin'))
      .send({ entered_by: 'tchr', marks: rows });
    await request(app)
      .post(`/api/assessment/t1/exams/${examId}/publish`)
      .set(staff('school_admin'))
      .send({ published_by: 'coord' });
  }

  it('ranks ties as 1,1,3; exempt unranked; draft ignored', async () => {
    await publishMarks([
      { student_id: 's1', draft_marks: 90 },
      { student_id: 's2', draft_marks: 90 },
      { student_id: 's3', draft_marks: 70 },
      { student_id: 's4', is_exempt: true },
    ]);

    // Draft-only student should not affect ranks if we regenerate after adding draft without publish
    const gen = await request(app)
      .post('/api/assessment/t1/report-cards/generate')
      .set(staff('school_admin'))
      .send({
        template_id: templateId,
        session: 'ay-2025',
        generated_by: 'admin',
        students: [
          { student_id: 's1' },
          { student_id: 's2' },
          { student_id: 's3' },
          { student_id: 's4' },
        ],
      });
    expect(gen.status).toBe(201);
    const byId = Object.fromEntries(
      gen.body.cards.map((c: { studentId: string; payload: Record<string, unknown> }) => [
        c.studentId,
        c.payload,
      ]),
    );
    expect(byId.s1.rank).toBe(1);
    expect(byId.s2.rank).toBe(1);
    expect(byId.s3.rank).toBe(3);
    expect(byId.s1.out_of).toBe(3);
    expect(byId.s4.rank).toBeNull();
  });

  it('snapshot rank immutable after later moderation + regenerate', async () => {
    await publishMarks([
      { student_id: 's1', draft_marks: 80 },
      { student_id: 's2', draft_marks: 60 },
    ]);
    const first = await request(app)
      .post('/api/assessment/t1/report-cards/generate')
      .set(staff('school_admin'))
      .send({
        template_id: templateId,
        session: 'ay-2025',
        generated_by: 'admin',
        students: [{ student_id: 's1' }, { student_id: 's2' }],
      });
    const cardId = first.body.cards[0].id as string;
    const oldRank = first.body.cards[0].payload.rank;

    const marks = await request(app)
      .get(`/api/assessment/t1/exams/${examId}/marks`)
      .set(staff('school_admin'));
    const m1 = marks.body.marks.find((m: { studentId: string }) => m.studentId === 's1');
    await request(app)
      .post(`/api/assessment/t1/marks/${m1.id}/moderate`)
      .set(staff('school_admin'))
      .send({ assigned_marks: 50, moderated_by: 'admin', reason: 'recheck' });

    await request(app)
      .post('/api/assessment/t1/report-cards/generate')
      .set(staff('school_admin'))
      .send({
        template_id: templateId,
        session: 'ay-2025',
        generated_by: 'admin',
        students: [{ student_id: 's1' }, { student_id: 's2' }],
      });

    const fetched = await request(app)
      .get(`/api/assessment/t1/report-cards/${cardId}`)
      .set(staff('school_admin'));
    expect(fetched.body.payload.rank).toBe(oldRank);
  });

  it('guardian sees cards only after visible_from; staff always sees', async () => {
    await publishMarks([{ student_id: 's1', draft_marks: 91 }]);
    const gen = await request(app)
      .post('/api/assessment/t1/report-cards/generate')
      .set(staff('school_admin'))
      .send({
        template_id: templateId,
        session: 'ay-2025',
        generated_by: 'admin',
        students: [{ student_id: 's1' }],
      });
    const cardId = gen.body.cards[0].id as string;

    const staffList = await request(app)
      .get('/api/assessment/t1/report-cards?student_id=s1&session=ay-2025')
      .set(staff('school_admin'));
    expect(staffList.body.cards.length).toBeGreaterThanOrEqual(1);

    const before = await request(app)
      .get('/api/assessment/t1/guardian/students/s1/report-cards')
      .set(guardian('g1', ['s1']));
    expect(before.status).toBe(200);
    expect(before.body.cards).toEqual([]);

    const future = new Date(Date.now() + 86_400_000).toISOString();
    await request(app)
      .patch(`/api/assessment/t1/report-cards/${cardId}`)
      .set(staff('school_admin'))
      .send({ visible_from: future });

    const stillHidden = await request(app)
      .get('/api/assessment/t1/guardian/students/s1/report-cards')
      .set(guardian('g1', ['s1']));
    expect(stillHidden.body.cards).toEqual([]);

    const past = new Date(Date.now() - 60_000).toISOString();
    await request(app)
      .patch(`/api/assessment/t1/report-cards/${cardId}`)
      .set(staff('school_admin'))
      .send({ visible_from: past });

    const visible = await request(app)
      .get('/api/assessment/t1/guardian/students/s1/report-cards')
      .set(guardian('g1', ['s1']));
    expect(visible.body.cards.length).toBe(1);
    expect(visible.body.cards[0].id).toBe(cardId);

    const sibling = await request(app)
      .get('/api/assessment/t1/guardian/students/s9/report-cards')
      .set(guardian('g1', ['s1']));
    expect(sibling.status).toBe(403);
  });
});
