import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolAcademicsApp, type SchoolAcademicsSqlite } from '../src/index';

describe('school-academics homework (P3-06)', () => {
  let app: Express;
  let db: SchoolAcademicsSqlite;
  let courseId: string;
  let topicId: string;

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
    const topic = await request(app)
      .post(`/api/academics/t1/units/${unit.body.id}/topics`).set(staff('school_admin'))
      .send({ label: 'Topic A' });
    topicId = topic.body.id;
  });

  afterEach(async () => {
    await db.close();
  });

  async function createAssignment(overrides: Record<string, unknown> = {}) {
    return request(app)
      .post('/api/academics/t1/assignments').set(staff('school_admin'))
      .send({
        course_id: courseId,
        section_ref: '8A',
        topic_id: topicId,
        title: 'Worksheet 1',
        max_points: 10,
        due_at: '2030-01-01T00:00:00.000Z',
        assigned_by: 'tchr-1',
        student_ids: ['s1', 's2', 's3'],
        ...overrides,
      });
  }

  it('fans out assigned submissions and infers resource delivery', async () => {
    const res = await createAssignment();
    expect(res.status).toBe(201);
    expect(res.body.assignment.topicId).toBe(topicId);
    expect(res.body.submissions).toHaveLength(3);
    expect(res.body.submissions.every((s: { state: string }) => s.state === 'assigned')).toBe(
      true,
    );

    const coverage = await request(app).get(
      `/api/academics/t1/courses/${courseId}/coverage?section_ref=8A`,
    ).set(staff('school_admin'));
    expect(coverage.status).toBe(200);
    expect(coverage.body.units[0].topicsDelivered).toBe(1);

    const deliveries = await db.all<{ source: string; period_instance_id: string }>(
      `SELECT source, period_instance_id FROM topic_delivery WHERE tenant_id = ? AND topic_id = ?`,
      ['t1', topicId],
    );
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.source).toBe('inferred_resource');
    expect(deliveries[0]!.period_instance_id).toBe(res.body.assignment.id);
  });

  it('turn-in / reclaim / late / grade separation / return', async () => {
    const lateAssign = await createAssignment({
      due_at: '2020-01-01T00:00:00.000Z',
      student_ids: ['s1', 's2'],
    });
    const sub1 = lateAssign.body.submissions[0].id as string;
    const sub2 = lateAssign.body.submissions[1].id as string;

    const turned = await request(app).post(`/api/academics/t1/submissions/${sub1}/turn-in`).set(staff('school_admin'));
    expect(turned.status).toBe(200);
    expect(turned.body.state).toBe('turned_in');
    expect(turned.body.late).toBe(true);

    const reclaim = await request(app).post(`/api/academics/t1/submissions/${sub1}/reclaim`).set(staff('school_admin'));
    expect(reclaim.status).toBe(200);
    expect(reclaim.body.state).toBe('reclaimed');

    const again = await request(app).post(`/api/academics/t1/submissions/${sub1}/turn-in`).set(staff('school_admin'));
    expect(again.status).toBe(200);
    expect(again.body.state).toBe('turned_in');

    const direct = await request(app)
      .patch(`/api/academics/t1/submissions/${sub1}/grade`).set(staff('school_admin'))
      .send({ assigned_grade: 9 });
    expect(direct.status).toBe(400);

    const draft = await request(app)
      .patch(`/api/academics/t1/submissions/${sub1}/grade`).set(staff('school_admin'))
      .send({ draft_grade: 8 });
    expect(draft.status).toBe(200);
    expect(draft.body.draftGrade).toBe(8);
    expect(draft.body.assignedGrade).toBeNull();

    const returned = await request(app)
      .post(`/api/academics/t1/submissions/${sub1}/return`).set(staff('school_admin'))
      .send({ feedback: 'Good' });
    expect(returned.status).toBe(200);
    expect(returned.body.state).toBe('returned');
    expect(returned.body.assignedGrade).toBe(8);
    expect(returned.body.feedback).toBe('Good');

    await request(app).post(`/api/academics/t1/submissions/${sub2}/turn-in`).set(staff('school_admin'));
    await request(app)
      .patch(`/api/academics/t1/submissions/${sub2}/grade`).set(staff('school_admin'))
      .send({ draft_grade: 6 });
    await request(app).post(`/api/academics/t1/submissions/${sub2}/return`).set(staff('school_admin'));
  });

  it('stats exclude excused; sweep marks missing', async () => {
    const created = await createAssignment({
      due_at: '2020-06-01T00:00:00.000Z',
      student_ids: ['a', 'b', 'c'],
      max_points: 10,
    });
    const [sa, sb, sc] = created.body.submissions.map((s: { id: string }) => s.id);

    await request(app).post(`/api/academics/t1/submissions/${sa}/turn-in`).set(staff('school_admin'));
    await request(app).patch(`/api/academics/t1/submissions/${sa}/grade`).set(staff('school_admin')).send({ draft_grade: 10 });
    await request(app).post(`/api/academics/t1/submissions/${sa}/return`).set(staff('school_admin'));

    await request(app).post(`/api/academics/t1/submissions/${sb}/turn-in`).set(staff('school_admin'));
    await request(app).patch(`/api/academics/t1/submissions/${sb}/grade`).set(staff('school_admin')).send({ draft_grade: 4 });
    await request(app).post(`/api/academics/t1/submissions/${sb}/return`).set(staff('school_admin'));
    await request(app).patch(`/api/academics/t1/submissions/${sb}/excuse`).set(staff('school_admin')).send({ excused: true });

    const stats = await request(app).get(
      `/api/academics/t1/assignments/${created.body.assignment.id}/stats`,
    ).set(staff('school_admin'));
    expect(stats.status).toBe(200);
    expect(stats.body.mean).toBe(10);
    expect(stats.body.median).toBe(10);
    expect(stats.body.excusedCount).toBe(1);
    expect(stats.body.gradedCount).toBe(1);
    expect(stats.body.counts.returned).toBe(2);

    const sweep = await request(app).post(
      `/api/academics/t1/assignments/${created.body.assignment.id}/sweep-missing`,
    ).set(staff('school_admin'));
    expect(sweep.status).toBe(200);
    expect(sweep.body.updated).toHaveLength(1);
    expect(sweep.body.updated[0].id).toBe(sc);
    expect(sweep.body.updated[0].missing).toBe(true);
    expect(sweep.body.updated[0].draftGrade).toBe(0);
  });

  it('tenant isolation', async () => {
    const created = await createAssignment({ student_ids: ['s1'] });
    const other = await request(app).get(
      `/api/academics/t2/assignments/${created.body.assignment.id}`,
    ).set(staff('school_admin'));
    expect(other.status).toBe(404);
  });
});
