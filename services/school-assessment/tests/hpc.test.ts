import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolAssessmentApp,
  SAMPLE_HPC_COMPETENCY_COUNT,
  deriveLevelFromCircled,
  majorityLevel,
  type SchoolAssessmentSqlite,
} from '../src/index';

describe('hpc level helpers (P4-04)', () => {
  it.each([
    [0, 'beginner'],
    [2, 'beginner'],
    [3, 'proficient'],
    [4, 'proficient'],
    [5, 'advanced'],
    [6, 'advanced'],
  ] as const)('circled %i → %s', (n, level) => {
    expect(deriveLevelFromCircled(n)).toBe(level);
  });

  it('majority with tie picks higher level', () => {
    expect(majorityLevel(['beginner', 'beginner', 'proficient', 'proficient'])).toBe(
      'proficient',
    );
    expect(majorityLevel(['beginner', 'advanced', 'beginner', 'advanced'])).toBe('advanced');
    expect(majorityLevel(['beginner', 'beginner', 'proficient'])).toBe('beginner');
  });
});

describe('school-assessment HPC (P4-04)', () => {
  let app: Express;
  let db: SchoolAssessmentSqlite;
  let middleId: string;
  let secondaryId: string;
  let foundationalId: string;

  beforeEach(async () => {
    const created = await createSchoolAssessmentApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
    });
    app = created.app;
    db = created.db;

    const comps = await request(app).get('/api/assessment/t1/hpc/competencies').set(staff('school_admin'));
    expect(comps.body.competencies).toHaveLength(SAMPLE_HPC_COMPETENCY_COUNT);
    middleId = comps.body.competencies.find(
      (c: { stage: string }) => c.stage === 'middle',
    ).id;
    secondaryId = comps.body.competencies.find(
      (c: { stage: string }) => c.stage === 'secondary',
    ).id;
    foundationalId = comps.body.competencies.find(
      (c: { stage: string }) => c.stage === 'foundational',
    ).id;
  });

  afterEach(async () => {
    await db.close();
  });

  it('middle circled→level derivation; both fields → 400', async () => {
    const both = await request(app).post('/api/assessment/t1/hpc/inputs').set(staff('school_admin')).send({
      student_id: 's1',
      competency_id: middleId,
      source: 'teacher',
      statements_circled: 4,
      level: 'beginner',
      recorded_by: 'tchr-1',
    });
    expect(both.status).toBe(400);

    const ok = await request(app).post('/api/assessment/t1/hpc/inputs').set(staff('school_admin')).send({
      student_id: 's1',
      competency_id: middleId,
      source: 'teacher',
      statements_circled: 5,
      recorded_by: 'tchr-1',
      academic_session_ref: 'ay-2025',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.statementsCircled).toBe(5);
    expect(ok.body.level).toBe('advanced');

    const direct = await request(app).post('/api/assessment/t1/hpc/inputs').set(staff('school_admin')).send({
      student_id: 's1',
      competency_id: foundationalId,
      source: 'self',
      level: 'proficient',
      recorded_by: 's1',
    });
    expect(direct.status).toBe(201);
    expect(direct.body.level).toBe('proficient');
  });

  it('four-voice grouping + latest per source', async () => {
    const base = {
      student_id: 's1',
      competency_id: foundationalId,
      recorded_by: 'staff',
      academic_session_ref: 'ay-2025',
    };
    await request(app)
      .post('/api/assessment/t1/hpc/inputs').set(staff('school_admin'))
      .send({ ...base, source: 'self', level: 'beginner', at: '2025-01-01T00:00:00.000Z' });
    await request(app)
      .post('/api/assessment/t1/hpc/inputs').set(staff('school_admin'))
      .send({ ...base, source: 'self', level: 'advanced', at: '2025-06-01T00:00:00.000Z' });
    await request(app)
      .post('/api/assessment/t1/hpc/inputs').set(staff('school_admin'))
      .send({ ...base, source: 'peer', level: 'proficient', at: '2025-03-01T00:00:00.000Z' });
    await request(app)
      .post('/api/assessment/t1/hpc/inputs').set(staff('school_admin'))
      .send({ ...base, source: 'teacher', level: 'beginner', at: '2025-02-01T00:00:00.000Z' });
    await request(app)
      .post('/api/assessment/t1/hpc/inputs').set(staff('school_admin'))
      .send({ ...base, source: 'parent', level: 'proficient', at: '2025-04-01T00:00:00.000Z' });

    const view = await request(app).get(
      '/api/assessment/t1/hpc/students/s1?session=ay-2025',
    ).set(staff('school_admin'));
    expect(view.status).toBe(200);
    const row = view.body.competencies.find(
      (c: { competencyId: string }) => c.competencyId === foundationalId,
    );
    expect(row.voices.self).toBe('advanced');
    expect(row.voices.peer).toBe('proficient');
    expect(row.voices.teacher).toBe('beginner');
    expect(row.voices.parent).toBe('proficient');
    expect(row.inputCount).toBe(5);
  });

  it('matrix majority + tie; bulk cap', async () => {
    const base = {
      student_id: 's2',
      competency_id: secondaryId,
      source: 'teacher' as const,
      recorded_by: 'tchr',
      academic_session_ref: 'ay-2025',
    };
    await request(app)
      .post('/api/assessment/t1/hpc/inputs').set(staff('school_admin'))
      .send({ ...base, level: 'beginner' });
    await request(app)
      .post('/api/assessment/t1/hpc/inputs').set(staff('school_admin'))
      .send({ ...base, level: 'beginner' });
    await request(app)
      .post('/api/assessment/t1/hpc/inputs').set(staff('school_admin'))
      .send({ ...base, level: 'advanced' });
    await request(app)
      .post('/api/assessment/t1/hpc/inputs').set(staff('school_admin'))
      .send({ ...base, level: 'advanced' });

    const matrix = await request(app).get('/api/assessment/t1/hpc/students/s2/matrix').set(staff('school_admin'));
    expect(matrix.status).toBe(200);
    const cell = matrix.body.cells.find(
      (c: { competencyId: string; session: string }) =>
        c.competencyId === secondaryId && c.session === 'ay-2025',
    );
    expect(cell.level).toBe('advanced');
    expect(cell.teacherInputCount).toBe(4);

    const tooMany = Array.from({ length: 201 }, (_, i) => ({
      student_id: `sx${i}`,
      competency_id: foundationalId,
      source: 'peer',
      level: 'beginner',
      recorded_by: 'batch',
    }));
    const capped = await request(app)
      .post('/api/assessment/t1/hpc/inputs/bulk').set(staff('school_admin'))
      .send({ inputs: tooMany });
    expect(capped.status).toBe(400);

    const bulk = await request(app)
      .post('/api/assessment/t1/hpc/inputs/bulk').set(staff('school_admin'))
      .send({
        inputs: [
          {
            student_id: 's9',
            competency_id: foundationalId,
            source: 'peer',
            level: 'proficient',
            recorded_by: 'batch',
          },
        ],
      });
    expect(bulk.status).toBe(201);
    expect(bulk.body.inputs).toHaveLength(1);
  });

  it('coverage math; tenant isolation', async () => {
    const stageComps = await request(app).get(
      '/api/assessment/t1/hpc/competencies?stage=foundational',
    ).set(staff('school_admin'));
    const compId = stageComps.body.competencies[0].id as string;

    for (const student of ['a', 'b', 'c']) {
      await request(app).post('/api/assessment/t1/hpc/inputs').set(staff('school_admin')).send({
        student_id: student,
        competency_id: compId,
        source: 'teacher',
        level: 'beginner',
        recorded_by: 't',
      });
    }
    await request(app).post('/api/assessment/t1/hpc/inputs').set(staff('school_admin')).send({
      student_id: 'a',
      competency_id: compId,
      source: 'self',
      level: 'proficient',
      recorded_by: 'a',
    });
    await request(app).post('/api/assessment/t1/hpc/inputs').set(staff('school_admin')).send({
      student_id: 'b',
      competency_id: compId,
      source: 'self',
      level: 'beginner',
      recorded_by: 'b',
    });
    // c has teacher only — not filled

    const cov = await request(app).get(
      '/api/assessment/t1/hpc/coverage?section_students=a,b,c&stage=foundational',
    ).set(staff('school_admin'));
    expect(cov.status).toBe(200);
    const row = cov.body.coverage.find(
      (r: { competencyId: string }) => r.competencyId === compId,
    );
    expect(row.filledCount).toBe(2);
    expect(row.studentCount).toBe(3);
    expect(row.pct).toBe(66.7);

    await request(app).post('/api/assessment/t1/hpc/inputs').set(staff('school_admin')).send({
      student_id: 'iso',
      competency_id: foundationalId,
      source: 'self',
      level: 'beginner',
      recorded_by: 'iso',
    });
    const other = await request(app).get('/api/assessment/t2/hpc/students/iso').set(staff('school_admin'));
    expect(other.status).toBe(200);
    expect(other.body.competencies).toEqual([]);
  });
});
