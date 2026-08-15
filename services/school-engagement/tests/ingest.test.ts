import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolEngagementApp,
  type NotifyPayload,
  type NotifySink,
  type SchoolEngagementSqlite,
} from '../src/index';

describe('school-engagement ingest + digest (P5-03)', () => {
  let app: Express;
  let db: SchoolEngagementSqlite;
  let sinkCalls: NotifyPayload[];
  let clock: { now: Date };

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
    });
    app = created.app;
    db = created.db;

    await request(app).put('/api/engagement/t1/guardians/g1/channels').send({
      channels: [
        { channel: 'whatsapp', address: '+91222', priority: 1, verified: true },
      ],
    });
    await request(app).put('/api/engagement/t1/settings').send({
      daily_cap_per_student: 1,
      quiet_start: 21,
      quiet_end: 7,
    });
  });

  afterEach(async () => {
    await db.close();
  });

  it('marked_absent unexplained queues absence_alert; explained drops', async () => {
    const alert = await request(app).post('/api/engagement/t1/ingest').send({
      type: 'school.attendance.marked_absent',
      tenantId: 't1',
      occurredAt: clock.now.toISOString(),
      data: {
        guardian_ref: 'g1',
        student_ref: 's1',
        explained: false,
        student_name: 'Asha',
        date: '2025-09-10',
        period_label: 'P1',
      },
    });
    expect(alert.status).toBe(201);
    expect(alert.body.templateKey).toBe('absence_alert');
    expect(alert.body.status).toBe('sent');
    expect(sinkCalls).toHaveLength(1);

    const dropped = await request(app).post('/api/engagement/t1/ingest').send({
      type: 'school.attendance.marked_absent',
      data: {
        guardian_ref: 'g1',
        student_ref: 's1',
        explained: true,
        date: '2025-09-10',
        period_label: 'P1',
      },
    });
    expect(dropped.status).toBe(200);
    expect(dropped.body.dropped).toBe(true);
    expect(sinkCalls).toHaveLength(1);
  });

  it('unknown event returns 200 dropped', async () => {
    const res = await request(app).post('/api/engagement/t1/ingest').send({
      type: 'school.something.else',
      data: { foo: 1 },
    });
    expect(res.status).toBe(200);
    expect(res.body.dropped).toBe(true);
  });

  it('nudge.send is cap_exempt', async () => {
    const first = await request(app).post('/api/engagement/t1/messages').send({
      guardian_ref: 'g1',
      student_ref: 's1',
      template_key: 'absence_alert',
      urgency: 'interrupt',
      vars: { student_name: 'A', date: '2025-09-10', period_label: 'P1' },
    });
    expect(first.body.status).toBe('sent');

    const capped = await request(app).post('/api/engagement/t1/messages').send({
      guardian_ref: 'g1',
      student_ref: 's1',
      template_key: 'attendance_nudge',
      urgency: 'interrupt',
      vars: { student_name: 'A', date: '2025-09-10' },
    });
    expect(capped.body.status).toBe('suppressed_cap');

    const nudge = await request(app).post('/api/engagement/t1/ingest').send({
      type: 'school.nudge.send',
      data: {
        guardian_ref: 'g1',
        student_ref: 's1',
        student_name: 'A',
        date: '2025-09-10',
      },
    });
    expect(nudge.status).toBe(201);
    expect(nudge.body.templateKey).toBe('attendance_nudge');
    expect(nudge.body.status).toBe('sent');
  });

  it('digest groups per guardian and is idempotent', async () => {
    await request(app).post('/api/engagement/t1/messages').send({
      guardian_ref: 'g1',
      student_ref: 's1',
      template_key: 'attendance_nudge',
      urgency: 'digest',
      vars: { student_name: 'A', date: '2025-09-10' },
    });
    await request(app).post('/api/engagement/t1/messages').send({
      guardian_ref: 'g1',
      student_ref: 's2',
      template_key: 'attendance_nudge',
      urgency: 'digest',
      vars: { student_name: 'B', date: '2025-09-10' },
    });

    const run1 = await request(app).post('/api/engagement/t1/digest/run').send({
      date: '2025-09-10',
    });
    expect(run1.status).toBe(200);
    expect(run1.body.guardians).toBe(1);
    expect(run1.body.messages).toHaveLength(1);
    expect(run1.body.messages[0].renderedBody).toContain('Daily digest');
    expect(run1.body.messages[0].renderedBody).toContain('A');
    expect(run1.body.messages[0].renderedBody).toContain('B');

    const queued = await request(app).get(
      '/api/engagement/t1/messages?status=queued&date=2025-09-10',
    );
    expect(queued.body.messages).toEqual([]);

    const run2 = await request(app).post('/api/engagement/t1/digest/run').send({
      date: '2025-09-10',
    });
    expect(run2.body.guardians).toBe(0);
    expect(run2.body.skipped).toBe(0);
  });

  it('ack removes from pending-escalation; tenant isolation', async () => {
    const alert = await request(app).post('/api/engagement/t1/ingest').send({
      type: 'school.attendance.marked_absent',
      data: {
        guardian_ref: 'g1',
        student_ref: 's1',
        explained: false,
        student_name: 'A',
        date: '2025-09-10',
        period_label: 'P1',
      },
    });
    expect(alert.status).toBe(201);
    const id = alert.body.id as string;

    clock.now = new Date('2025-09-10T14:00:00.000Z');
    const pending = await request(app).get(
      '/api/engagement/t1/pending-escalation?minutes=90',
    );
    expect(pending.body.messages).toHaveLength(1);
    expect(pending.body.messages[0].id).toBe(id);

    const otherTenant = await request(app).get(
      '/api/engagement/t2/pending-escalation?minutes=90',
    );
    expect(otherTenant.body.messages).toEqual([]);

    const ack = await request(app).post(`/api/engagement/t1/messages/${id}/ack`).send({
      acked_by: 'office-1',
    });
    expect(ack.status).toBe(200);

    const after = await request(app).get(
      '/api/engagement/t1/pending-escalation?minutes=90',
    );
    expect(after.body.messages).toEqual([]);
  });
});
