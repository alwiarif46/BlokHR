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

describe('school-assessment report cards (P4-05)', () => {
  let app: Express;
  let db: SchoolAssessmentSqlite;
  let events: DomainEvent[];
  let examId: string;

  beforeEach(async () => {
    events = [];
    const publisher: EventPublisher = {
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

  async function createSandboxTemplate() {
    return request(app).post('/api/assessment/t1/templates').set(staff('school_admin')).send({
      label: 'Term Report',
      board_format: 'cbse_9pt',
      definition: [
        { type: 'marks_table', config: { aggregation: 'avg' } },
        { type: 'hpc_summary', config: {} },
        { type: 'remarks', config: {} },
        { type: 'custom_text', config: { text: 'All the best' } },
      ],
    });
  }

  it('sandbox / promote / clone lifecycle and 409 on live edit', async () => {
    const created = await createSandboxTemplate();
    expect(created.status).toBe(201);
    expect(created.body.state).toBe('sandbox');
    expect(created.body.version).toBe(1);

    const promoted = await request(app).post(
      `/api/assessment/t1/templates/${created.body.id}/promote`,
    ).set(staff('school_admin'));
    expect(promoted.status).toBe(200);
    expect(promoted.body.state).toBe('live');
    expect(promoted.body.version).toBe(2);

    const liveEdit = await request(app)
      .patch(`/api/assessment/t1/templates/${created.body.id}`).set(staff('school_admin'))
      .send({ label: 'Nope' });
    expect(liveEdit.status).toBe(409);
    expect(liveEdit.body.error).toBe('promote_a_sandbox_copy');

    const cloned = await request(app).post(
      `/api/assessment/t1/templates/${created.body.id}/clone`,
    ).set(staff('school_admin'));
    expect(cloned.status).toBe(201);
    expect(cloned.body.state).toBe('sandbox');
    expect(cloned.body.id).not.toBe(created.body.id);

    const second = await createSandboxTemplate();
    await request(app).post(`/api/assessment/t1/templates/${second.body.id}/promote`).set(staff('school_admin'));
    const old = await request(app).get(
      `/api/assessment/t1/templates/${created.body.id}`,
    ).set(staff('school_admin'));
    expect(old.body.state).toBe('retired');
  });

  it('published marks only; snapshot immutable; event; tenant isolation', async () => {
    const tmpl = await createSandboxTemplate();
    await request(app).post(`/api/assessment/t1/templates/${tmpl.body.id}/promote`).set(staff('school_admin'));

    await request(app).put(`/api/assessment/t1/exams/${examId}/marks`).set(staff('school_admin')).send({
      entered_by: 'tchr',
      marks: [{ student_id: 's1', draft_marks: 91 }],
    });

    const draftOnly = await request(app)
      .post('/api/assessment/t1/report-cards/generate').set(staff('school_admin'))
      .send({
        template_id: tmpl.body.id,
        session: 'ay-2025',
        generated_by: 'admin',
        students: [{ student_id: 's1', remarks: 'Good' }],
      });
    expect(draftOnly.status).toBe(201);
    const draftBlock = draftOnly.body.cards[0].payload.blocks.find(
      (b: { type: string }) => b.type === 'marks_table',
    );
    expect(draftBlock.data.entries).toHaveLength(0);

    await request(app)
      .post(`/api/assessment/t1/exams/${examId}/publish`).set(staff('school_admin'))
      .send({ published_by: 'coord' });

    const published = await request(app)
      .post('/api/assessment/t1/report-cards/generate').set(staff('school_admin'))
      .send({
        template_id: tmpl.body.id,
        session: 'ay-2025',
        generated_by: 'admin',
        students: [{ student_id: 's1', remarks: 'Good', attendance: { pct: 96 } }],
      });
    expect(published.status).toBe(201);
    const cardId = published.body.cards[0].id as string;
    const marksBlock = published.body.cards[0].payload.blocks.find(
      (b: { type: string }) => b.type === 'marks_table',
    );
    expect(marksBlock.data.entries).toHaveLength(1);
    expect(marksBlock.data.entries[0].assignedMarks).toBe(91);
    expect(marksBlock.data.aggregateGrade.grade).toBe('A1');
    expect(
      events.some((e) => e.type === 'school.reportcard.generated'),
    ).toBe(true);

    // Snapshot immutability: clone+edit sandbox must not change existing card
    const clone = await request(app).post(
      `/api/assessment/t1/templates/${tmpl.body.id}/clone`,
    ).set(staff('school_admin'));
    await request(app)
      .patch(`/api/assessment/t1/templates/${clone.body.id}`).set(staff('school_admin'))
      .send({
        definition: [{ type: 'custom_text', config: { text: 'CHANGED' } }],
      });

    const fetched = await request(app).get(`/api/assessment/t1/report-cards/${cardId}`).set(staff('school_admin'));
    expect(fetched.status).toBe(200);
    expect(fetched.body.payload.blocks).toHaveLength(4);
    expect(
      fetched.body.payload.blocks.find((b: { type: string }) => b.type === 'custom_text')
        .data.text,
    ).toBe('All the best');

    const listed = await request(app).get(
      '/api/assessment/t1/report-cards?student_id=s1&session=ay-2025',
    ).set(staff('school_admin'));
    expect(listed.body.cards.length).toBeGreaterThanOrEqual(2);

    const other = await request(app).get(`/api/assessment/t2/report-cards/${cardId}`).set(staff('school_admin'));
    expect(other.status).toBe(404);
  });
});
