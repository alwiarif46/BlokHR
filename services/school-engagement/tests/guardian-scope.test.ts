import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolEngagementApp,
  type SchoolEngagementSqlite,
} from '../src/index';

const SECRET = 'test-internal-secret';

describe('school-engagement guardian threads (P9-03)', () => {
  let app: Express;
  let db: SchoolEngagementSqlite;

  beforeEach(async () => {
    const created = await createSchoolEngagementApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('forces guardian_ref from header; blocks other guardian threads', async () => {
    const created = await request(app)
      .post('/api/engagement/t1/threads')
      .set('X-Blok-Internal', SECRET)
      .set('X-Blok-Principal', 'guardian')
      .set('X-Blok-Guardian', 'g-real')
      .send({
        guardian_ref: 'g-spoof',
        student_ref: 's1',
        subject: 'Hello',
        body: 'Hi school',
        author: 'spoof',
      });
    expect(created.status).toBe(201);
    expect(created.body.thread.guardianRef).toBe('g-real');
    const id = created.body.thread.id as string;

    const other = await request(app)
      .get(`/api/engagement/t1/threads/${id}`)
      .set('X-Blok-Internal', SECRET)
      .set('X-Blok-Principal', 'guardian')
      .set('X-Blok-Guardian', 'g-other');
    expect(other.status).toBe(403);

    const own = await request(app)
      .get(`/api/engagement/t1/threads/${id}`)
      .set('X-Blok-Internal', SECRET)
      .set('X-Blok-Principal', 'guardian')
      .set('X-Blok-Guardian', 'g-real');
    expect(own.status).toBe(200);

    const replySpoof = await request(app)
      .post(`/api/engagement/t1/threads/${id}/reply`)
      .set('X-Blok-Internal', SECRET)
      .set('X-Blok-Principal', 'guardian')
      .set('X-Blok-Guardian', 'g-real')
      .send({
        direction: 'school',
        body: 'Thanks',
        author: 'attacker',
      });
    expect(replySpoof.status).toBe(201);
    expect(replySpoof.body.message.direction).toBe('guardian');

    const noSecret = await request(app)
      .post('/api/engagement/t1/threads')
      .set('X-Blok-Principal', 'guardian')
      .set('X-Blok-Guardian', 'g-real')
      .send({
        guardian_ref: 'g-real',
        student_ref: 's1',
        subject: 'X',
        body: 'Y',
        author: 'a',
      });
    expect(noSecret.status).toBe(401);

    const staff = await request(app).post('/api/engagement/t1/threads').send({
      guardian_ref: 'g-staff',
      student_ref: 's2',
      subject: 'Staff',
      body: 'Body',
      author: 'office',
    });
    expect(staff.status).toBe(201);
    expect(staff.body.thread.guardianRef).toBe('g-staff');

    const cross = await request(app)
      .get(`/api/engagement/t2/threads/${id}`)
      .set('X-Blok-Internal', SECRET)
      .set('X-Blok-Principal', 'guardian')
      .set('X-Blok-Guardian', 'g-real');
    expect(cross.status).toBe(404);
  });
});
