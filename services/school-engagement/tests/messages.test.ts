import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolEngagementApp,
  SAMPLE_MESSAGE_TEMPLATE_COUNT,
  isInQuietHours,
  type NotifyPayload,
  type NotifySink,
  type SchoolEngagementSqlite,
} from '../src/index';
import { SECRET, staff } from './helpers/auth';

describe('quiet hours helper', () => {
  it('handles overnight window', () => {
    expect(isInQuietHours(22, 21, 7)).toBe(true);
    expect(isInQuietHours(3, 21, 7)).toBe(true);
    expect(isInQuietHours(12, 21, 7)).toBe(false);
  });
});

describe('school-engagement messages (P5-02)', () => {
  let app: Express;
  let db: SchoolEngagementSqlite;
  let sinkCalls: NotifyPayload[];
  let clock: { now: Date };
  const admin = staff('school_admin');
  const office = staff('office');

  beforeEach(async () => {
    sinkCalls = [];
    clock = { now: new Date('2025-09-10T12:00:00.000Z') };
    const sink: NotifySink = {
      send: async (p) => {
        sinkCalls.push(p);
      },
    };
    const created = await createSchoolEngagementApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      notifySink: sink,
      clock: () => clock.now,
      internalSecret: SECRET,
    });
    app = created.app;
    db = created.db;

    await request(app)
      .put('/api/engagement/t1/guardians/g1/channels')
      .set(admin)
      .send({
        channels: [
          { channel: 'sms', address: '+91111', priority: 2, verified: false },
          { channel: 'whatsapp', address: '+91222', priority: 1, verified: true },
        ],
      });
    await request(app)
      .put('/api/engagement/t1/settings')
      .set(admin)
      .send({
        daily_cap_per_student: 2,
        quiet_start: 21,
        quiet_end: 7,
      });
  });

  afterEach(async () => {
    await db.close();
  });

  it('seeds global templates; resolution chain tenant→lang→en', async () => {
    const seeded = await db.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM message_templates WHERE tenant_id IS NULL`,
    );
    expect(Number(seeded?.c)).toBe(SAMPLE_MESSAGE_TEMPLATE_COUNT);

    await request(app)
      .post('/api/engagement/t1/templates')
      .set(admin)
      .send({
        key: 'attendance_nudge',
        lang: 'hi',
        body: 'Tenant HI nudge for {{student_name}} on {{date}}.',
      });

    const hi = await request(app)
      .post('/api/engagement/t1/messages')
      .set(office)
      .send({
        guardian_ref: 'g1',
        student_ref: 's1',
        template_key: 'attendance_nudge',
        lang: 'hi',
        urgency: 'interrupt',
        vars: { student_name: 'Asha', date: '2025-09-10' },
      });
    expect(hi.status).toBe(201);
    expect(hi.body.renderedBody).toContain('Tenant HI nudge');
    expect(hi.body.lang).toBe('hi');

    const frFallback = await request(app)
      .post('/api/engagement/t1/messages')
      .set(office)
      .send({
        guardian_ref: 'g1',
        student_ref: 's2',
        template_key: 'absence_alert',
        lang: 'fr',
        urgency: 'interrupt',
        vars: { student_name: 'Ram', date: '2025-09-10', period_label: 'P1' },
      });
    expect(frFallback.status).toBe(201);
    expect(frFallback.body.lang).toBe('en');
    expect(frFallback.body.renderedBody).toContain('Absence alert');
  });

  it('var validation; channel walk; digest queue', async () => {
    const missing = await request(app)
      .post('/api/engagement/t1/messages')
      .set(office)
      .send({
        guardian_ref: 'g1',
        template_key: 'absence_alert',
        urgency: 'interrupt',
        vars: { student_name: 'A' },
      });
    expect(missing.status).toBe(400);
    expect(missing.body.missing).toEqual(expect.arrayContaining(['date', 'period_label']));

    const sent = await request(app)
      .post('/api/engagement/t1/messages')
      .set(office)
      .send({
        guardian_ref: 'g1',
        student_ref: 's1',
        template_key: 'absence_alert',
        urgency: 'interrupt',
        vars: { student_name: 'A', date: '2025-09-10', period_label: 'P1' },
      });
    expect(sent.status).toBe(201);
    expect(sent.body.status).toBe('sent');
    expect(sent.body.channel).toBe('whatsapp');
    expect(sinkCalls).toHaveLength(1);
    expect(sinkCalls[0]!.address).toBe('+91222');

    const digest = await request(app)
      .post('/api/engagement/t1/messages')
      .set(office)
      .send({
        guardian_ref: 'g1',
        student_ref: 's1',
        template_key: 'attendance_nudge',
        urgency: 'digest',
        vars: { student_name: 'A', date: '2025-09-10' },
      });
    expect(digest.status).toBe(201);
    expect(digest.body.status).toBe('queued');
    expect(sinkCalls).toHaveLength(1);
  });

  it('daily cap and quiet hours with absence exception', async () => {
    const vars = { student_name: 'A', date: '2025-09-10', period_label: 'P1' };
    await request(app).post('/api/engagement/t1/messages').set(office).send({
      guardian_ref: 'g1',
      student_ref: 's1',
      template_key: 'absence_alert',
      urgency: 'interrupt',
      vars,
    });
    await request(app).post('/api/engagement/t1/messages').set(office).send({
      guardian_ref: 'g1',
      student_ref: 's1',
      template_key: 'absence_alert',
      urgency: 'interrupt',
      vars,
    });
    const capped = await request(app)
      .post('/api/engagement/t1/messages')
      .set(office)
      .send({
        guardian_ref: 'g1',
        student_ref: 's1',
        template_key: 'absence_alert',
        urgency: 'interrupt',
        vars,
      });
    expect(capped.body.status).toBe('suppressed_cap');

    clock.now = new Date('2025-09-10T22:00:00.000Z');
    const quietNudge = await request(app)
      .post('/api/engagement/t1/messages')
      .set(office)
      .send({
        guardian_ref: 'g1',
        student_ref: 's9',
        template_key: 'attendance_nudge',
        urgency: 'interrupt',
        vars: { student_name: 'B', date: '2025-09-10' },
      });
    expect(quietNudge.body.status).toBe('suppressed_quiet');

    const quietAbsence = await request(app)
      .post('/api/engagement/t1/messages')
      .set(office)
      .send({
        guardian_ref: 'g1',
        student_ref: 's9',
        template_key: 'absence_alert',
        urgency: 'interrupt',
        vars,
      });
    expect(quietAbsence.body.status).toBe('sent');
  });

  it('tenant isolation', async () => {
    await request(app).post('/api/engagement/t1/messages').set(office).send({
      guardian_ref: 'g1',
      student_ref: 's1',
      template_key: 'attendance_nudge',
      urgency: 'interrupt',
      vars: { student_name: 'A', date: '2025-09-10' },
    });
    const other = await request(app)
      .get('/api/engagement/t2/messages?student_ref=s1')
      .set(office);
    expect(other.body.messages).toEqual([]);
  });
});
