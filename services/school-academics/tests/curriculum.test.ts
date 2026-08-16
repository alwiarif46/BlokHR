import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolAcademicsApp, type SchoolAcademicsSqlite } from '../src/index';

describe('school-academics curriculum (P3-02)', () => {
  let app: Express;
  let db: SchoolAcademicsSqlite;

  beforeEach(async () => {
    const created = await createSchoolAcademicsApp({
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

  async function createCourse(tenant = 't1') {
    const res = await request(app).post(`/api/academics/${tenant}/courses`).set(staff('school_admin')).send({
      academic_session_id: 'ay-2025',
      board: 'cbse',
      subject_code: 'Sc',
      class_label: '8',
      label: 'Science 8',
    });
    expect(res.status).toBe(201);
    return res.body as { id: string };
  }

  it('assembles course tree with units, topics, and outcome tags', async () => {
    const course = await createCourse();
    const u1 = await request(app)
      .post(`/api/academics/t1/courses/${course.id}/units`).set(staff('school_admin'))
      .send({ label: 'Unit A', planned_weeks: 2, planned_start_week: 1 });
    const u2 = await request(app)
      .post(`/api/academics/t1/courses/${course.id}/units`).set(staff('school_admin'))
      .send({ label: 'Unit B', planned_weeks: 3 });
    expect(u1.status).toBe(201);
    expect(u2.status).toBe(201);

    const topic = await request(app)
      .post(`/api/academics/t1/units/${u1.body.id}/topics`).set(staff('school_admin'))
      .send({ label: 'Topic 1', estimated_periods: 2 });
    expect(topic.status).toBe(201);

    const outcomes = await request(app).get(
      '/api/academics/t1/outcomes?class=8&subject=Sc',
    ).set(staff('school_admin'));
    const outcomeId = outcomes.body.outcomes[0].id as string;

    const act = await request(app)
      .post(`/api/academics/t1/units/${u1.body.id}/outcomes`).set(staff('school_admin'))
      .send({ outcome_id: outcomeId, field: 'activity', depth: 'reinforced' });
    expect(act.status).toBe(201);
    expect(act.body.depth).toBe('reinforced');

    const tree = await request(app).get(`/api/academics/t1/courses/${course.id}/tree`).set(staff('school_admin'));
    expect(tree.status).toBe(200);
    expect(tree.body.units).toHaveLength(2);
    expect(tree.body.units[0].topics).toHaveLength(1);
    expect(tree.body.units[0].outcomes).toHaveLength(1);
    expect(tree.body.units[0].outcomes[0].field).toBe('activity');
  });

  it('reorders units', async () => {
    const course = await createCourse();
    const a = await request(app)
      .post(`/api/academics/t1/courses/${course.id}/units`).set(staff('school_admin'))
      .send({ label: 'First', planned_weeks: 1 });
    const b = await request(app)
      .post(`/api/academics/t1/courses/${course.id}/units`).set(staff('school_admin'))
      .send({ label: 'Second', planned_weeks: 1 });

    const reordered = await request(app)
      .put(`/api/academics/t1/courses/${course.id}/units/reorder`).set(staff('school_admin'))
      .send({ ordered_ids: [b.body.id, a.body.id] });
    expect(reordered.status).toBe(200);
    expect(reordered.body.units.map((u: { id: string }) => u.id)).toEqual([
      b.body.id,
      a.body.id,
    ]);
    expect(reordered.body.units.map((u: { sequence: number }) => u.sequence)).toEqual([
      1, 2,
    ]);
  });

  it('assessment requires activity; depth values validated', async () => {
    const course = await createCourse();
    const unit = await request(app)
      .post(`/api/academics/t1/courses/${course.id}/units`).set(staff('school_admin'))
      .send({ label: 'U', planned_weeks: 1 });
    const outcomes = await request(app).get(
      '/api/academics/t1/outcomes?class=8&subject=Sc',
    ).set(staff('school_admin'));
    const outcomeId = outcomes.body.outcomes[0].id as string;

    const bad = await request(app)
      .post(`/api/academics/t1/units/${unit.body.id}/outcomes`).set(staff('school_admin'))
      .send({ outcome_id: outcomeId, field: 'assessment' });
    expect(bad.status).toBe(400);

    await request(app)
      .post(`/api/academics/t1/units/${unit.body.id}/outcomes`).set(staff('school_admin'))
      .send({ outcome_id: outcomeId, field: 'activity', depth: 'introduced' });

    const ok = await request(app)
      .post(`/api/academics/t1/units/${unit.body.id}/outcomes`).set(staff('school_admin'))
      .send({ outcome_id: outcomeId, field: 'assessment', depth: 'mastered' });
    expect(ok.status).toBe(201);
    expect(ok.body.depth).toBe('mastered');

    const badDepth = await request(app)
      .post(`/api/academics/t1/units/${unit.body.id}/outcomes`).set(staff('school_admin'))
      .send({
        outcome_id: outcomes.body.outcomes[1].id,
        field: 'activity',
        depth: 'expert',
      });
    expect(badDepth.status).toBe(400);
  });

  it('tenant isolation for courses', async () => {
    const c1 = await createCourse('t1');
    await createCourse('t2');
    const list1 = await request(app).get('/api/academics/t1/courses').set(staff('school_admin'));
    const list2 = await request(app).get('/api/academics/t2/courses').set(staff('school_admin'));
    expect(list1.body.courses).toHaveLength(1);
    expect(list2.body.courses).toHaveLength(1);
    expect(list1.body.courses[0].id).toBe(c1.id);
    expect(list2.body.courses[0].id).not.toBe(c1.id);

    const steal = await request(app).get(`/api/academics/t2/courses/${c1.id}/tree`).set(staff('school_admin'));
    expect(steal.status).toBe(404);
  });
});
