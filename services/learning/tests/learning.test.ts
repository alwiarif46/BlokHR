import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createLearningApp, type LearningSqlite } from '../src/index';

const ADMIN = 'admin@blokhr.test';
const USER = 'employee@blokhr.test';

describe('learning service', () => {
  let app: Express;
  let db: LearningSqlite;

  beforeEach(async () => {
    const created = await createLearningApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      tenantId: 'default',
      routerOptions: {
        tenantId: 'default',
        isAdmin: async (email) => email === ADMIN,
      },
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('health ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('rejects unauthenticated course create', async () => {
    const res = await request(app).post('/api/training/courses').send({ title: 'X' });
    expect(res.status).toBe(401);
  });

  it('rejects non-admin course create', async () => {
    const res = await request(app)
      .post('/api/training/courses')
      .set('X-User-Email', USER)
      .send({ title: 'Safety 101' });
    expect(res.status).toBe(403);
  });

  it('creates, lists, and publishes a course', async () => {
    const create = await request(app)
      .post('/api/training/courses')
      .set('X-User-Email', ADMIN)
      .send({
        title: 'Safety 101',
        category: 'compliance',
        format: 'video',
        mandatory: true,
      });
    expect(create.status).toBe(201);
    expect(create.body.course.title).toBe('Safety 101');
    expect(create.body.course.status).toBe('draft');

    const asUser = await request(app)
      .get('/api/training/courses')
      .set('X-User-Email', USER);
    expect(asUser.status).toBe(200);
    expect(asUser.body.courses).toHaveLength(0);

    const publish = await request(app)
      .post(`/api/training/courses/${create.body.course.id}/publish`)
      .set('X-User-Email', ADMIN);
    expect(publish.status).toBe(200);

    const listed = await request(app)
      .get('/api/training/courses')
      .set('X-User-Email', USER);
    expect(listed.body.courses).toHaveLength(1);
  });

  it('validates course title', async () => {
    const res = await request(app)
      .post('/api/training/courses')
      .set('X-User-Email', ADMIN)
      .send({ title: '  ' });
    expect(res.status).toBe(400);
  });

  it('isolates tenants', async () => {
    await request(app)
      .post('/api/training/courses')
      .set('X-User-Email', ADMIN)
      .send({ title: 'Tenant A course', status: 'published' });

    const other = await createLearningApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      tenantId: 'tenant-b',
      routerOptions: {
        tenantId: 'tenant-b',
        isAdmin: async () => true,
      },
    });
    const listB = await request(other.app)
      .get('/api/training/courses')
      .set('X-User-Email', ADMIN);
    expect(listB.body.courses).toHaveLength(0);
    await other.db.close();
  });

  it('orders lessons and completes them to drive progress and skills', async () => {
    const courseRes = await request(app)
      .post('/api/training/courses')
      .set('X-User-Email', ADMIN)
      .send({ title: 'Onboarding', format: 'doc' });
    const courseId = courseRes.body.course.id;

    await request(app)
      .post(`/api/training/courses/${courseId}/publish`)
      .set('X-User-Email', ADMIN);

    const skillRes = await request(app)
      .post('/api/training/skills')
      .set('X-User-Email', ADMIN)
      .send({ name: 'Company Policies' });
    expect(skillRes.status).toBe(201);

    await request(app)
      .post(`/api/training/courses/${courseId}/skills`)
      .set('X-User-Email', ADMIN)
      .send({ skillId: skillRes.body.skill.id, proficiency: 'beginner' });

    const l1 = await request(app)
      .post(`/api/training/courses/${courseId}/lessons`)
      .set('X-User-Email', ADMIN)
      .send({ title: 'Welcome', type: 'video', durationMinutes: 10 });
    const l2 = await request(app)
      .post(`/api/training/courses/${courseId}/lessons`)
      .set('X-User-Email', ADMIN)
      .send({ title: 'Handbook', type: 'doc', durationMinutes: 20 });
    expect(l1.status).toBe(201);
    expect(l2.status).toBe(201);
    expect(l1.body.lesson.position).toBe(0);
    expect(l2.body.lesson.position).toBe(1);

    const reorder = await request(app)
      .put(`/api/training/courses/${courseId}/lessons/reorder`)
      .set('X-User-Email', ADMIN)
      .send({ orderedIds: [l2.body.lesson.id, l1.body.lesson.id] });
    expect(reorder.status).toBe(200);

    const detail = await request(app)
      .get(`/api/training/courses/${courseId}`)
      .set('X-User-Email', ADMIN);
    expect(detail.body.lessons[0].id).toBe(l2.body.lesson.id);
    expect(detail.body.lessons[1].id).toBe(l1.body.lesson.id);

    const enroll = await request(app)
      .post('/api/training/enroll')
      .set('X-User-Email', USER)
      .send({ courseId });
    expect(enroll.status).toBe(201);
    const enrollmentId = enroll.body.enrollment.id;

    const done1 = await request(app)
      .put(`/api/training/enrollments/${enrollmentId}/lessons/${l2.body.lesson.id}`)
      .set('X-User-Email', USER)
      .send({});
    expect(done1.status).toBe(200);
    expect(done1.body.enrollment.progressPct).toBe(50);
    expect(done1.body.enrollment.status).toBe('in_progress');

    const done2 = await request(app)
      .put(`/api/training/enrollments/${enrollmentId}/lessons/${l1.body.lesson.id}`)
      .set('X-User-Email', USER)
      .send({});
    expect(done2.status).toBe(200);
    expect(done2.body.enrollment.progressPct).toBe(100);
    expect(done2.body.enrollment.status).toBe('completed');

    const skills = await request(app)
      .get('/api/training/skills/employee')
      .set('X-User-Email', USER);
    expect(skills.body.skills.some((s: { skillName: string }) => s.skillName === 'Company Policies')).toBe(
      true,
    );

    const mine = await request(app)
      .get('/api/training/my-courses')
      .set('X-User-Email', USER);
    expect(mine.body.enrollments).toHaveLength(1);
    expect(mine.body.enrollments[0].lessons).toHaveLength(2);
  });

  it('forbids completing another user lesson', async () => {
    const courseRes = await request(app)
      .post('/api/training/courses')
      .set('X-User-Email', ADMIN)
      .send({ title: 'X', status: 'draft' });
    const courseId = courseRes.body.course.id;
    await request(app)
      .post(`/api/training/courses/${courseId}/publish`)
      .set('X-User-Email', ADMIN);
    const lesson = await request(app)
      .post(`/api/training/courses/${courseId}/lessons`)
      .set('X-User-Email', ADMIN)
      .send({ title: 'L1' });
    const enroll = await request(app)
      .post('/api/training/enroll')
      .set('X-User-Email', USER)
      .send({ courseId });

    const res = await request(app)
      .put(
        `/api/training/enrollments/${enroll.body.enrollment.id}/lessons/${lesson.body.lesson.id}`,
      )
      .set('X-User-Email', ADMIN)
      .send({});
    expect(res.status).toBe(403);
  });

  it('gates compliance and budgets behind admin', async () => {
    const comp = await request(app)
      .get('/api/training/reports/compliance')
      .set('X-User-Email', USER);
    expect(comp.status).toBe(403);

    const bud = await request(app)
      .put('/api/training/budgets')
      .set('X-User-Email', USER)
      .send({ groupId: 'eng', year: 2026, annualBudget: 1000 });
    expect(bud.status).toBe(403);

    const ok = await request(app)
      .put('/api/training/budgets')
      .set('X-User-Email', ADMIN)
      .send({ groupId: 'eng', year: 2026, annualBudget: 1000, perEmployeeCap: 200 });
    expect(ok.status).toBe(200);
    expect(ok.body.budget.annualBudget).toBe(1000);
  });
});
