import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff, internalOnly } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolAcademicsApp, type SchoolAcademicsSqlite } from '../src/index';

describe('school-academics delivery (P3-04)', () => {
  let app: Express;
  let db: SchoolAcademicsSqlite;
  let courseId: string;
  let unitId: string;
  let topicA: string;
  let topicB: string;
  let outcomeId: string;

  beforeEach(async () => {
    const created = await createSchoolAcademicsApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
    });
    app = created.app;
    db = created.db;

    const course = await request(app).post('/api/academics/t1/courses').set(staff('school_admin')).send({
      academic_session_id: 'ay-2025',
      board: 'cbse',
      subject_code: 'Sc',
      class_label: '8',
      label: 'Science 8',
    });
    courseId = course.body.id;
    const unit = await request(app)
      .post(`/api/academics/t1/courses/${courseId}/units`).set(staff('school_admin'))
      .send({ label: 'Unit 1', planned_weeks: 2 });
    unitId = unit.body.id;
    const t1 = await request(app)
      .post(`/api/academics/t1/units/${unitId}/topics`).set(staff('school_admin'))
      .send({ label: 'Topic A' });
    const t2 = await request(app)
      .post(`/api/academics/t1/units/${unitId}/topics`).set(staff('school_admin'))
      .send({ label: 'Topic B' });
    topicA = t1.body.id;
    topicB = t2.body.id;

    const outcomes = await request(app).get(
      '/api/academics/t1/outcomes?class=8&subject=Sc',
    ).set(staff('school_admin'));
    outcomeId = outcomes.body.outcomes[0].id;
    await request(app)
      .post(`/api/academics/t1/units/${unitId}/outcomes`).set(staff('school_admin'))
      .send({ outcome_id: outcomeId, field: 'activity' });
    await request(app)
      .post(`/api/academics/t1/units/${unitId}/outcomes`).set(staff('school_admin'))
      .send({ outcome_id: outcomeId, field: 'assessment' });
  });

  afterEach(async () => {
    await db.close();
  });

  it('assert, unique conflict, undo within window', async () => {
    const asserted = await request(app).post('/api/academics/t1/delivery').set(staff('school_admin')).send({
      topic_id: topicA,
      period_instance_id: 'pi-1',
      section_ref: '8A',
      date: '2025-09-10',
      teacher_member_id: 'tchr-1',
    });
    expect(asserted.status).toBe(201);
    expect(asserted.body.source).toBe('asserted');
    expect(asserted.body.createdAt).toBeTruthy();

    const dup = await request(app).post('/api/academics/t1/delivery').set(staff('school_admin')).send({
      topic_id: topicA,
      period_instance_id: 'pi-1',
      section_ref: '8A',
      date: '2025-09-10',
      teacher_member_id: 'tchr-1',
    });
    expect(dup.status).toBe(409);

    const undo = await request(app).delete(
      `/api/academics/t1/delivery/${asserted.body.id}`,
    ).set(staff('school_admin'));
    expect(undo.status).toBe(204);

    await request(app).post('/api/academics/t1/delivery').set(staff('school_admin')).send({
      topic_id: topicA,
      period_instance_id: 'pi-2',
      section_ref: '8A',
      date: '2025-09-11',
      teacher_member_id: 'tchr-1',
    });
    const row = await db.get<{ id: string }>(
      `SELECT id FROM topic_delivery WHERE period_instance_id = 'pi-2'`,
    );
    await db.run(
      `UPDATE topic_delivery SET created_at = datetime('now', '-50 hours') WHERE id = ?`,
      [row!.id],
    );
    const late = await request(app).delete(`/api/academics/t1/delivery/${row!.id}`).set(staff('school_admin'));
    expect(late.status).toBe(409);
  });

  it('coverage math and outcome field split', async () => {
    await request(app).post('/api/academics/t1/delivery').set(staff('school_admin')).send({
      topic_id: topicA,
      period_instance_id: 'pi-a',
      section_ref: '8A',
      date: '2025-09-10',
      teacher_member_id: 'tchr-1',
    });

    const cov = await request(app).get(
      `/api/academics/t1/courses/${courseId}/coverage?section_ref=8A`,
    ).set(staff('school_admin'));
    expect(cov.status).toBe(200);
    expect(cov.body.units).toHaveLength(1);
    const u = cov.body.units[0];
    expect(u.topicsTotal).toBe(2);
    expect(u.topicsDelivered).toBe(1);
    expect(u.pct).toBe(50);
    expect(u.firstDeliveryDate).toBe('2025-09-10');
    expect(u.lastDeliveryDate).toBe('2025-09-10');
    expect(u.outcomes[0].outcomeId).toBe(outcomeId);
    expect(u.outcomes[0].coveredActivity).toBe(true);
    expect(u.outcomes[0].coveredAssessment).toBe(true);

    const empty = await request(app).get(
      `/api/academics/t1/courses/${courseId}/coverage?section_ref=8B`,
    ).set(staff('school_admin'));
    expect(empty.body.units[0].topicsDelivered).toBe(0);
    expect(empty.body.units[0].outcomes[0].coveredActivity).toBe(false);
  });

  it('inference + asserted wins; no duplicate', async () => {
    const inferred = await request(app).post('/api/academics/t1/delivery/infer').set(internalOnly()).send({
      kind: 'resource',
      topic_id: topicB,
      section_ref: '8A',
      date: '2025-09-12',
      ref: 'hw-99',
    });
    expect(inferred.status).toBe(201);
    expect(inferred.body.source).toBe('inferred_resource');
    expect(inferred.body.periodInstanceId).toBe('hw-99');

    const again = await request(app).post('/api/academics/t1/delivery/infer').set(internalOnly()).send({
      kind: 'assessment',
      topic_id: topicB,
      section_ref: '8A',
      date: '2025-09-13',
      ref: 'hw-99',
    });
    expect(again.status).toBe(200);
    expect(again.body.created).toBe(false);
    expect(again.body.source).toBe('inferred_resource');

    const assertOver = await request(app).post('/api/academics/t1/delivery').set(staff('school_admin')).send({
      topic_id: topicB,
      period_instance_id: 'hw-99',
      section_ref: '8A',
      date: '2025-09-12',
      teacher_member_id: 'tchr-1',
    });
    expect(assertOver.status).toBe(201);
    expect(assertOver.body.source).toBe('asserted');
    expect(assertOver.body.id).toBe(inferred.body.id);
  });

  it('tenant isolation for delivery', async () => {
    const a = await request(app).post('/api/academics/t1/delivery').set(staff('school_admin')).send({
      topic_id: topicA,
      period_instance_id: 'pi-x',
      section_ref: '8A',
      date: '2025-09-10',
      teacher_member_id: 'tchr-1',
    });
    const steal = await request(app).delete(`/api/academics/t2/delivery/${a.body.id}`).set(staff('school_admin'));
    expect(steal.status).toBe(404);

    const course2 = await request(app).post('/api/academics/t2/courses').set(staff('school_admin')).send({
      academic_session_id: 'ay',
      board: 'cbse',
      subject_code: 'Sc',
      class_label: '8',
      label: 'S',
    });
    const cov = await request(app).get(
      `/api/academics/t2/courses/${course2.body.id}/coverage?section_ref=8A`,
    ).set(staff('school_admin'));
    expect(cov.status).toBe(200);
    expect(cov.body.units).toEqual([]);
  });

  it('variance route returns report for section deliveries + instances', async () => {
    await request(app).post('/api/academics/t1/delivery').set(staff('school_admin')).send({
      topic_id: topicA,
      period_instance_id: 'pi-v1',
      section_ref: '8A',
      date: '2025-03-03',
      teacher_member_id: 'tchr-1',
    });
    const res = await request(app)
      .post(`/api/academics/t1/courses/${courseId}/variance`).set(staff('school_admin'))
      .send({
        section_ref: '8A',
        instances: [
          { id: 'i1', week: 10, status: 'lost', lost_reason: 'holiday' },
        ],
        target_date: '2025-12-01',
      });
    expect(res.status).toBe(200);
    expect(res.body.units).toBeTruthy();
    expect(res.body.plannedCurve).toBeTruthy();
    expect(res.body.actualCurve).toBeTruthy();
    expect(typeof res.body.remainingTopics).toBe('number');
  });
});
