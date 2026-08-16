import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp } from '../helpers/setup';

describe('learning mount via /api/training', () => {
  let app: Express;
  let db: DatabaseEngine;
  let learning: { close: () => Promise<void> };

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    db = ctx.db;
    learning = ctx.learning;
    await db.run('INSERT OR IGNORE INTO admins (email) VALUES (?)', ['admin@test.com']);
  });

  afterAll(async () => {
    await learning.close();
    await db.close();
  });

  it('creates and lists a course through the monolith mount', async () => {
    const create = await request(app)
      .post('/api/training/courses')
      .set('X-User-Email', 'admin@test.com')
      .set('X-User-Name', 'Admin')
      .send({
        title: 'Monolith Mount Course',
        category: 'general',
        format: 'doc',
        mandatory: false,
      });

    expect(create.status).toBe(201);
    expect(create.body.course).toBeDefined();
    expect(create.body.course.title).toBe('Monolith Mount Course');
    expect(create.body.course.status).toBe('draft');

    const listAdmin = await request(app)
      .get('/api/training/courses')
      .set('X-User-Email', 'admin@test.com');
    expect(listAdmin.status).toBe(200);
    expect(listAdmin.body.courses.some((c: { title: string }) => c.title === 'Monolith Mount Course')).toBe(
      true,
    );

    const publish = await request(app)
      .post(`/api/training/courses/${create.body.course.id}/publish`)
      .set('X-User-Email', 'admin@test.com');
    expect(publish.status).toBe(200);

    const lesson = await request(app)
      .post(`/api/training/courses/${create.body.course.id}/lessons`)
      .set('X-User-Email', 'admin@test.com')
      .send({ title: 'Module 1', type: 'doc', durationMinutes: 15 });
    expect(lesson.status).toBe(201);
    expect(lesson.body.lesson.title).toBe('Module 1');
  });

  it('blocks non-admin from creating courses', async () => {
    const res = await request(app)
      .post('/api/training/courses')
      .set('X-User-Email', 'employee@test.com')
      .send({ title: 'Nope' });
    expect(res.status).toBe(403);
  });
});
