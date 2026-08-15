import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolEngagementApp,
  type SchoolEngagementSqlite,
} from '../src/index';

describe('school-engagement prefs (P5-01)', () => {
  let app: Express;
  let db: SchoolEngagementSqlite;

  beforeEach(async () => {
    const created = await createSchoolEngagementApp({
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

  it('health ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('channels PUT full-replace ordered by priority', async () => {
    const put = await request(app)
      .put('/api/engagement/t1/guardians/g1/channels')
      .send({
        channels: [
          { channel: 'sms', address: '+911', priority: 2, verified: true },
          { channel: 'whatsapp', address: '+912', priority: 1, verified: false },
          { channel: 'push', address: 'tok', priority: 3, is_active: false },
        ],
      });
    expect(put.status).toBe(200);
    expect(put.body.channels.map((c: { channel: string }) => c.channel)).toEqual([
      'whatsapp',
      'sms',
      'push',
    ]);
    expect(put.body.channels[0].priority).toBe(1);

    const listed = await request(app).get('/api/engagement/t1/guardians/g1/channels');
    expect(listed.body.channels).toHaveLength(3);

    const replace = await request(app)
      .put('/api/engagement/t1/guardians/g1/channels')
      .send({
        channels: [{ channel: 'ivr', address: '+919', priority: 1, verified: true }],
      });
    expect(replace.body.channels).toHaveLength(1);
    expect(replace.body.channels[0].channel).toBe('ivr');
  });

  it('settings GET defaults + PUT validation', async () => {
    const defaults = await request(app).get('/api/engagement/t1/settings');
    expect(defaults.status).toBe(200);
    expect(defaults.body.dailyCapPerStudent).toBe(3);
    expect(defaults.body.digestHour).toBe(17);
    expect(defaults.body.quietStart).toBe(21);

    const badCap = await request(app).put('/api/engagement/t1/settings').send({
      daily_cap_per_student: 11,
    });
    expect(badCap.status).toBe(400);

    const badHour = await request(app).put('/api/engagement/t1/settings').send({
      digest_hour: 24,
    });
    expect(badHour.status).toBe(400);

    const ok = await request(app).put('/api/engagement/t1/settings').send({
      daily_cap_per_student: 5,
      digest_hour: 18,
      digest_frequency: 'weekly',
      quiet_start: 22,
      quiet_end: 6,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.dailyCapPerStudent).toBe(5);
    expect(ok.body.digestFrequency).toBe('weekly');
    expect(ok.body.quietEnd).toBe(6);
  });

  it('tenant isolation', async () => {
    await request(app).put('/api/engagement/t1/guardians/g1/channels').send({
      channels: [{ channel: 'sms', address: '+911', priority: 1 }],
    });
    await request(app).put('/api/engagement/t1/settings').send({
      daily_cap_per_student: 4,
    });

    const channels = await request(app).get('/api/engagement/t2/guardians/g1/channels');
    expect(channels.body.channels).toEqual([]);

    const settings = await request(app).get('/api/engagement/t2/settings');
    expect(settings.body.dailyCapPerStudent).toBe(3);
  });
});
