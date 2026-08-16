import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolAcademicsApp, type SchoolAcademicsSqlite } from '../src/index';

describe('school-academics syllabus import/export (P3-07)', () => {
  let app: Express;
  let db: SchoolAcademicsSqlite;
  let courseId: string;
  let knownCode: string;

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

    const outcomes = await request(app).get(
      '/api/academics/t1/outcomes?class=8&subject=Sc',
    ).set(staff('school_admin'));
    knownCode = outcomes.body.outcomes[0].code as string;
  });

  afterEach(async () => {
    await db.close();
  });

  const validUnits = () => [
    {
      label: 'Motion',
      planned_weeks: 3,
      planned_start_week: 1,
      summary: 'Intro',
      topics: [
        { label: 'Speed', estimated_periods: 2 },
        { label: 'Velocity', estimated_periods: 1 },
      ],
      outcome_codes: [knownCode, 'NO.SUCH.CODE'],
    },
  ];

  it('atomic validation failure leaves course empty', async () => {
    const bad = await request(app)
      .post(`/api/academics/t1/courses/${courseId}/import`).set(staff('school_admin'))
      .send({
        units: [
          {
            label: 'Ok',
            planned_weeks: 2,
            topics: [{ label: 'A' }],
          },
          {
            label: '',
            planned_weeks: -1,
            topics: [],
          },
        ],
      });
    expect(bad.status).toBe(400);
    expect(Array.isArray(bad.body.errors)).toBe(true);
    expect(bad.body.errors.length).toBeGreaterThan(0);

    const tree = await request(app).get(`/api/academics/t1/courses/${courseId}/tree`).set(staff('school_admin'));
    expect(tree.body.units).toEqual([]);
  });

  it('warnings for unknown codes; errors for invalid rows', async () => {
    const ok = await request(app)
      .post(`/api/academics/t1/courses/${courseId}/import`).set(staff('school_admin'))
      .send({ units: validUnits() });
    expect(ok.status).toBe(200);
    expect(ok.body.warnings).toContain('unknown outcome code: NO.SUCH.CODE');
    expect(ok.body.units).toHaveLength(1);
    expect(ok.body.units[0].outcome_codes).toEqual([knownCode]);
  });

  it('replace guard when delivery rows exist', async () => {
    await request(app)
      .post(`/api/academics/t1/courses/${courseId}/import`).set(staff('school_admin'))
      .send({ units: validUnits() });

    const tree = await request(app).get(`/api/academics/t1/courses/${courseId}/tree`).set(staff('school_admin'));
    const topicId = tree.body.units[0].topics[0].id as string;

    await request(app).post('/api/academics/t1/delivery').set(staff('school_admin')).send({
      topic_id: topicId,
      period_instance_id: 'pi-1',
      section_ref: '8A',
      date: '2025-09-10',
      teacher_member_id: 'tchr-1',
    });

    const blocked = await request(app)
      .post(`/api/academics/t1/courses/${courseId}/import`).set(staff('school_admin'))
      .send({ mode: 'replace', units: validUnits() });
    expect(blocked.status).toBe(409);
  });

  it('round-trip import(export(x)) is identity', async () => {
    await request(app)
      .post(`/api/academics/t1/courses/${courseId}/import`).set(staff('school_admin'))
      .send({
        units: [
          {
            label: 'Motion',
            planned_weeks: 3,
            planned_start_week: 2,
            summary: 'Intro',
            topics: [
              { label: 'Speed', estimated_periods: 2 },
              { label: 'Velocity', estimated_periods: 1 },
            ],
            outcome_codes: [knownCode],
          },
        ],
      });

    const exported = await request(app).get(
      `/api/academics/t1/courses/${courseId}/export`,
    ).set(staff('school_admin'));
    expect(exported.status).toBe(200);

    const course2 = await request(app).post('/api/academics/t1/courses').set(staff('school_admin')).send({
      academic_session_id: 'ay-2025',
      board: 'cbse',
      subject_code: 'Sc',
      class_label: '8',
      label: 'Science 8 copy',
    });
    await request(app)
      .post(`/api/academics/t1/courses/${course2.body.id}/import`).set(staff('school_admin'))
      .send(exported.body);
    const again = await request(app).get(
      `/api/academics/t1/courses/${course2.body.id}/export`,
    ).set(staff('school_admin'));
    expect(again.body).toEqual(exported.body);

    // Same-course replace round-trip
    await request(app)
      .post(`/api/academics/t1/courses/${courseId}/import`).set(staff('school_admin'))
      .send({ mode: 'replace', ...exported.body });
    const replaced = await request(app).get(
      `/api/academics/t1/courses/${courseId}/export`,
    ).set(staff('school_admin'));
    expect(replaced.body).toEqual(exported.body);
  });

  it('tenant isolation', async () => {
    await request(app)
      .post(`/api/academics/t1/courses/${courseId}/import`).set(staff('school_admin'))
      .send({ units: validUnits() });
    const other = await request(app).get(`/api/academics/t2/courses/${courseId}/export`).set(staff('school_admin'));
    expect(other.status).toBe(404);
  });
});
