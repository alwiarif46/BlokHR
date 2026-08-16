import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import http from 'http';
import fs from 'fs';
import type { Express } from 'express';
import {
  createSchoolAssessmentApp,
  HttpAcademicsClient,
  type AcademicsClient,
  type InferAssessmentDeliveryInput,
  type SchoolAssessmentSqlite,
} from '../src/index';

describe('school-assessment feedback (P4-06)', () => {
  let app: Express;
  let db: SchoolAssessmentSqlite;
  let examId: string;
  let inferCalls: InferAssessmentDeliveryInput[];
  let failingServer: http.Server | null = null;
  let failingUrl: string | null = null;

  beforeEach(async () => {
    inferCalls = [];
    const stubClient: AcademicsClient = {
      inferAssessmentDelivery: async (input) => {
        inferCalls.push(input);
      },
    };
    const created = await createSchoolAssessmentApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      academicsClient: stubClient,
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
      max_marks: 100,
      kind: 'summative',
    });
    examId = exam.body.id;

    const bp = await request(app).post('/api/assessment/t1/blueprints').set(staff('school_admin')).send({
      label: 'PT1 paper',
      class_label: '8',
      subject_code: 'Sc',
      total_marks: 100,
      rules: [
        { bucket: 'competency', pct: 40 },
        { bucket: 'objective', pct: 20 },
        { bucket: 'short_long', pct: 40 },
      ],
    });
    const q1 = await request(app).post('/api/assessment/t1/questions').set(staff('school_admin')).send({
      subject_code: 'Sc',
      class_label: '8',
      kind: 'case_based',
      marks: 40,
      outcome_code: '8.Sc.LO4',
      body: { stem: 'Q1', topic_id: 'topic-lo4' },
    });
    const q2 = await request(app).post('/api/assessment/t1/questions').set(staff('school_admin')).send({
      subject_code: 'Sc',
      class_label: '8',
      kind: 'mcq',
      marks: 20,
      outcome_code: '8.Sc.LO1',
      body: { stem: 'Q2', topic_id: 'topic-lo1' },
    });
    const q3 = await request(app).post('/api/assessment/t1/questions').set(staff('school_admin')).send({
      subject_code: 'Sc',
      class_label: '8',
      kind: 'sa',
      marks: 40,
      outcome_code: '8.Sc.LO4',
      body: { stem: 'Q3', topic_id: 'topic-lo4' },
    });
    await request(app).post('/api/assessment/t1/papers').set(staff('school_admin')).send({
      blueprint_id: bp.body.id,
      exam_ref: examId,
      question_ids: [q1.body.id, q2.body.id, q3.body.id],
    });

    await request(app).put(`/api/assessment/t1/exams/${examId}/marks`).set(staff('school_admin')).send({
      entered_by: 'tchr',
      marks: [
        { student_id: 's1', draft_marks: 80 },
        { student_id: 's2', draft_marks: 40 },
        { student_id: 's3', is_exempt: true },
      ],
    });
    await request(app)
      .post(`/api/assessment/t1/exams/${examId}/publish`).set(staff('school_admin'))
      .send({ published_by: 'coord' });
  });

  afterEach(async () => {
    await db.close();
    if (failingServer) {
      await new Promise<void>((resolve) => failingServer!.close(() => resolve()));
      failingServer = null;
    }
  });

  it('computes per-outcome mean pct and calls academics infer for topics', async () => {
    // publish already ran feedback; verify
    const rerun = await request(app)
      .post('/api/assessment/t1/feedback/run').set(staff('school_admin'))
      .send({ exam_id: examId });
    expect(rerun.status).toBe(200);
    expect(rerun.body.performances).toHaveLength(2);
    const lo4 = rerun.body.performances.find(
      (p: { outcomeCode: string }) => p.outcomeCode === '8.Sc.LO4',
    );
    const lo1 = rerun.body.performances.find(
      (p: { outcomeCode: string }) => p.outcomeCode === '8.Sc.LO1',
    );
    // mean of 80 and 40 = 60; exempt excluded
    expect(lo4.meanPct).toBe(60);
    expect(lo4.nStudents).toBe(2);
    expect(lo1.meanPct).toBe(60);

    const topicIds = [...new Set(inferCalls.map((c) => c.topicId))].sort();
    expect(topicIds).toEqual(['topic-lo1', 'topic-lo4']);
    expect(inferCalls.every((c) => c.sectionRef === '8A' && c.ref === examId)).toBe(true);
  });

  it('weak list + idempotent rerun', async () => {
    const weak = await request(app).get(
      '/api/assessment/t1/outcomes/weak?threshold=70&session=ay-2025',
    ).set(staff('school_admin'));
    expect(weak.status).toBe(200);
    expect(weak.body.outcomes.length).toBe(2);
    expect(
      weak.body.outcomes.every(
        (o: { meanPct: number; exams: unknown[] }) =>
          o.meanPct < 70 && o.exams.length === 1,
      ),
    ).toBe(true);

    const strong = await request(app).get(
      '/api/assessment/t1/outcomes/weak?threshold=50&session=ay-2025',
    ).set(staff('school_admin'));
    expect(strong.body.outcomes).toHaveLength(0);

    const first = await request(app)
      .post('/api/assessment/t1/feedback/run').set(staff('school_admin'))
      .send({ exam_id: examId });
    const second = await request(app)
      .post('/api/assessment/t1/feedback/run').set(staff('school_admin'))
      .send({ exam_id: examId });
    const strip = (rows: Array<Record<string, unknown>>) =>
      rows.map(({ computedAt: _c, ...rest }) => rest);
    expect(strip(second.body.performances)).toEqual(strip(first.body.performances));

    const rows = await db.all<{ c: number }>(
      `SELECT COUNT(*) as c FROM outcome_performance WHERE tenant_id = ? AND exam_id = ?`,
      ['t1', examId],
    );
    expect(Number(rows[0]!.c)).toBe(2);
  });

  it('swallows academics client failures', async () => {
    failingServer = http.createServer((_req, res) => {
      res.statusCode = 500;
      res.end('boom');
    });
    await new Promise<void>((resolve) => {
      failingServer!.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = failingServer.address();
    if (!addr || typeof addr === 'string') throw new Error('no port');
    failingUrl = `http://127.0.0.1:${addr.port}`;

    const client = new HttpAcademicsClient(pino({ level: 'silent' }), failingUrl);
    await expect(
      client.inferAssessmentDelivery({
        tenantId: 't1',
        topicId: 'topic-x',
        sectionRef: '8A',
        date: '2025-07-10',
        ref: examId,
      }),
    ).resolves.toBeUndefined();
  });

  it('tenant isolation for weak outcomes', async () => {
    const other = await request(app).get(
      '/api/assessment/t2/outcomes/weak?threshold=100',
    ).set(staff('school_admin'));
    expect(other.status).toBe(200);
    expect(other.body.outcomes).toEqual([]);
  });

  it('does not import school-academics internals', () => {
    const srcRoot = path.resolve(__dirname, '../src');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (full.endsWith('.ts')) files.push(full);
      }
    };
    walk(srcRoot);
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text).not.toMatch(/services\/school-academics/);
      expect(text).not.toMatch(/@blokhr\/school-academics/);
      expect(text).not.toMatch(/from ['"].*school-academics/);
    }
  });
});
