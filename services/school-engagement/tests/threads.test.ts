import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolEngagementApp,
  type SchoolEngagementSqlite,
} from '../src/index';

describe('school-engagement threads (P5-04)', () => {
  let app: Express;
  let db: SchoolEngagementSqlite;
  let clock: { now: Date };

  beforeEach(async () => {
    clock = { now: new Date('2025-09-10T12:00:00.000Z') };
    const created = await createSchoolEngagementApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      clock: () => clock.now,
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('state flips on reply; reopen closed; assign', async () => {
    const created = await request(app).post('/api/engagement/t1/threads').send({
      guardian_ref: 'g1',
      student_ref: 's1',
      subject: 'Fees',
      body: 'When is the due date?',
      author: 'guardian:g1',
    });
    expect(created.status).toBe(201);
    expect(created.body.thread.state).toBe('waiting_school');
    const id = created.body.thread.id as string;

    const schoolReply = await request(app)
      .post(`/api/engagement/t1/threads/${id}/reply`)
      .send({
        direction: 'school',
        body: 'Due Friday.',
        author: 'office-1',
      });
    expect(schoolReply.status).toBe(201);
    expect(schoolReply.body.thread.state).toBe('waiting_guardian');

    const guardianReply = await request(app)
      .post(`/api/engagement/t1/threads/${id}/reply`)
      .send({
        direction: 'guardian',
        body: 'Thanks.',
        author: 'guardian:g1',
      });
    expect(guardianReply.body.thread.state).toBe('waiting_school');

    const assigned = await request(app)
      .post(`/api/engagement/t1/threads/${id}/assign`)
      .send({ assigned_to: 'staff-9' });
    expect(assigned.status).toBe(200);
    expect(assigned.body.assignedTo).toBe('staff-9');

    const closed = await request(app).post(`/api/engagement/t1/threads/${id}/close`);
    expect(closed.body.state).toBe('closed');

    const reopen = await request(app).post(`/api/engagement/t1/threads/${id}/reply`).send({
      direction: 'guardian',
      body: 'One more question.',
      author: 'guardian:g1',
    });
    expect(reopen.status).toBe(201);
    expect(reopen.body.thread.state).toBe('open');
  });

  it('SLA overdue list for waiting_school', async () => {
    const a = await request(app).post('/api/engagement/t1/threads').send({
      guardian_ref: 'g1',
      student_ref: 's1',
      subject: 'Old',
      body: 'Hello',
      author: 'g1',
    });
    expect(a.status).toBe(201);

    clock.now = new Date('2025-09-10T13:00:00.000Z');
    const b = await request(app).post('/api/engagement/t1/threads').send({
      guardian_ref: 'g2',
      student_ref: 's2',
      subject: 'Fresh',
      body: 'Hi',
      author: 'g2',
    });
    expect(b.status).toBe(201);

    clock.now = new Date('2025-09-11T13:00:00.000Z');
    const overdue = await request(app).get(
      '/api/engagement/t1/threads/overdue?hours=24',
    );
    expect(overdue.status).toBe(200);
    expect(overdue.body.threads).toHaveLength(1);
    expect(overdue.body.threads[0].id).toBe(a.body.thread.id);
  });

  it('translated_flag required when body_translated set', async () => {
    const bad = await request(app).post('/api/engagement/t1/threads').send({
      guardian_ref: 'g1',
      student_ref: 's1',
      subject: 'Lang',
      body: 'नमस्ते',
      author: 'g1',
      body_translated: 'Hello',
      translated_flag: 0,
    });
    expect(bad.status).toBe(400);

    const ok = await request(app).post('/api/engagement/t1/threads').send({
      guardian_ref: 'g1',
      student_ref: 's1',
      subject: 'Lang',
      body: 'नमस्ते',
      author: 'g1',
      body_translated: 'Hello',
      translated_flag: 1,
    });
    expect(ok.status).toBe(201);
    expect(ok.body.message.translatedFlag).toBe(true);
    expect(ok.body.message.bodyTranslated).toBe('Hello');
  });

  it('tenant isolation', async () => {
    const created = await request(app).post('/api/engagement/t1/threads').send({
      guardian_ref: 'g1',
      student_ref: 's1',
      subject: 'Private',
      body: 'Secret',
      author: 'g1',
    });
    const id = created.body.thread.id as string;

    const otherList = await request(app).get('/api/engagement/t2/threads');
    expect(otherList.body.threads).toEqual([]);

    const otherGet = await request(app).get(`/api/engagement/t2/threads/${id}`);
    expect(otherGet.status).toBe(404);
  });
});
