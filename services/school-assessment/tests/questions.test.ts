import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolAssessmentApp,
  type SchoolAssessmentSqlite,
} from '../src/index';

describe('school-assessment questions/papers (P4-03)', () => {
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

  async function createQuestion(body: Record<string, unknown>) {
    return request(app)
      .post('/api/assessment/t1/questions')
      .send({
        subject_code: 'Sc',
        class_label: '10',
        body: { stem: 'Q' },
        ...body,
      });
  }

  it('questions CRUD, filters, provenance; tenant isolation', async () => {
    const created = await createQuestion({
      kind: 'mcq',
      marks: 1,
      outcome_code: '10.Sc.LO1',
      provenance: 'ai_assisted',
    });
    expect(created.status).toBe(201);
    expect(created.body.provenance).toBe('ai_assisted');
    expect(created.body.timesUsed).toBe(0);

    const filtered = await request(app).get(
      '/api/assessment/t1/questions?subject=Sc&kind=mcq&outcome=10.Sc.LO1',
    );
    expect(filtered.body.questions).toHaveLength(1);

    const patched = await request(app)
      .patch(`/api/assessment/t1/questions/${created.body.id}`)
      .send({ marks: 2, competency_style: true });
    expect(patched.status).toBe(200);
    expect(patched.body.marks).toBe(2);
    expect(patched.body.competencyStyle).toBe(true);

    const other = await request(app).get(
      `/api/assessment/t2/questions/${created.body.id}`,
    );
    expect(other.status).toBe(404);

    const del = await request(app).delete(
      `/api/assessment/t1/questions/${created.body.id}`,
    );
    expect(del.status).toBe(204);
  });

  it('conformance check + paper persist guard', async () => {
    const bp = await request(app).post('/api/assessment/t1/blueprints').send({
      label: 'CBSE X Sc',
      class_label: '10',
      subject_code: 'Sc',
      total_marks: 100,
      rules: [
        { bucket: 'competency', pct: 40 },
        { bucket: 'objective', pct: 20 },
        { bucket: 'short_long', pct: 40 },
      ],
    });
    expect(bp.status).toBe(201);

    const a = await createQuestion({
      kind: 'case_based',
      marks: 40,
      outcome_code: '10.Sc.LO1',
    });
    const b = await createQuestion({ kind: 'mcq', marks: 20 });
    const c = await createQuestion({ kind: 'sa', marks: 40, outcome_code: '10.Sc.LO2' });
    const ids = [a.body.id, b.body.id, c.body.id];

    const check = await request(app).post('/api/assessment/t1/papers/check').send({
      blueprint_id: bp.body.id,
      question_ids: ids,
    });
    expect(check.status).toBe(200);
    expect(check.body.pass).toBe(true);

    const bad = await request(app).post('/api/assessment/t1/papers').send({
      blueprint_id: bp.body.id,
      question_ids: [a.body.id, b.body.id],
    });
    expect(bad.status).toBe(400);
    expect(bad.body.report.pass).toBe(false);

    const ok = await request(app).post('/api/assessment/t1/papers').send({
      blueprint_id: bp.body.id,
      question_ids: ids,
      exam_ref: 'exam-1',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.questionIds).toEqual(ids);

    const reused = await request(app).get(`/api/assessment/t1/questions/${a.body.id}`);
    expect(reused.body.timesUsed).toBe(1);
  });

  it('analysis route returns review flags', async () => {
    const res = await request(app).post('/api/assessment/t1/questions/analysis').send({
      results: [
        { question_id: 'q1', scores: [1, 1, 1, 0, 0], max: 1 },
        { question_id: 'q2', scores: [1, 1, 1, 1, 1], max: 1 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.items[0].pValue).toBe(0.6);
    expect(res.body.items[0].review).toBe(false);
    expect(res.body.items[1].pValue).toBe(1);
    expect(res.body.items[1].review).toBe(true);
  });
});
