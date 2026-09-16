import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolEngagementApp,
  createStubIdentityClient,
  type SchoolEngagementSqlite,
} from '../src/index';
import { SECRET, staff } from './helpers/auth';

describe('school-engagement circulars', () => {
  let app: Express;
  let db: SchoolEngagementSqlite;
  const sectionA = '8|A';
  const office = staff('office');
  const teacher = staff('teacher', 'member-teacher-1');

  beforeEach(async () => {
    const created = await createSchoolEngagementApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
      identityClient: createStubIdentityClient(
        {},
        {
          [sectionA]: [
            { guardianId: 'g1', studentId: 's1' },
            { guardianId: 'g2', studentId: 's2' },
          ],
        },
      ),
    });
    app = created.app;
    db = created.db;

    await request(app)
      .put('/api/engagement/t1/guardians/g1/channels')
      .set(staff('school_admin'))
      .send({
        channels: [
          { channel: 'sms', address: '+911', priority: 1, verified: true },
        ],
      });
    await request(app)
      .put('/api/engagement/t1/guardians/g2/channels')
      .set(staff('school_admin'))
      .send({
        channels: [
          { channel: 'sms', address: '+912', priority: 1, verified: true },
        ],
      });
  });

  afterEach(async () => {
    await db.close();
  });

  it('POST /circulars fans out general messages to section guardians', async () => {
    const res = await request(app)
      .post('/api/engagement/t1/circulars')
      .set(office)
      .send({
        section_ref: sectionA,
        title: 'Sports Day',
        body: 'Please send sports kit on Friday.',
      });
    expect(res.status).toBe(201);
    expect(res.body.count).toBe(2);
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.messages[0].templateKey).toBe('general');
    expect(res.body.messages[0].renderedBody).toContain('Sports Day');
  });

  it('rejects teacher role and empty body', async () => {
    const denied = await request(app)
      .post('/api/engagement/t1/circulars')
      .set(teacher)
      .send({ section_ref: sectionA, body: 'x' });
    expect(denied.status).toBe(403);

    const bad = await request(app)
      .post('/api/engagement/t1/circulars')
      .set(office)
      .send({ section_ref: sectionA, body: '  ' });
    expect(bad.status).toBe(400);
  });

  it('503 when identity unavailable', async () => {
    const created = await createSchoolEngagementApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
      identityClient: null as unknown as undefined,
    });
    // no identityClient option → HTTP client with no URL → fail on call
    // recreate with stub that errors
    await created.db.close();

    const failing = await createSchoolEngagementApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
      identityClient: createStubIdentityClient({}, {}),
    });
    const res = await request(failing.app)
      .post('/api/engagement/t1/circulars')
      .set(office)
      .send({ section_ref: sectionA, body: 'Hello' });
    expect(res.status).toBe(503);
    await failing.db.close();
  });
});
