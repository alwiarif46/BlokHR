import crypto from 'crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

/** Helper: generate a signed email action token matching the email adapter's format. */
function signActionToken(payload: Record<string, unknown>, secret: string): string {
  const data = { ...payload, exp: Date.now() + 72 * 60 * 60 * 1000 };
  const encoded = Buffer.from(JSON.stringify(data)).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${hmac}`;
}

/** Helper: generate an expired token. */
function signExpiredToken(payload: Record<string, unknown>, secret: string): string {
  const data = { ...payload, exp: Date.now() - 1000 };
  const encoded = Buffer.from(JSON.stringify(data)).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${hmac}`;
}

describe('Interaction Receivers', () => {
  let app: Express;
  let db: DatabaseEngine;
  const ACTION_SECRET = 'test-action-secret-32chars-long!';

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, {
      email: 'alice@shaavir.com',
      name: 'Alice',
      groupId: 'engineering',
      groupName: 'Engineering',
      groupShiftStart: '09:00',
      groupShiftEnd: '18:00',
    });
    await seedMember(db, {
      email: 'bob@shaavir.com',
      name: 'Bob BD',
      groupId: 'bd',
      groupName: 'Business Development',
      groupShiftStart: '09:00',
      groupShiftEnd: '18:00',
    });
  });

  afterEach(async () => {
    await db.close();
  });

  // ── Helper: create a pending leave ──

  async function createPendingLeave(): Promise<string> {
    const res = await request(app)
      .post('/api/leave-submit')
      .send({
        personEmail: 'alice@shaavir.com',
        personName: 'Alice',
        leaveType: 'Casual',
        kind: 'FullDay',
        startDate: '2026-04-10',
        endDate: '2026-04-10',
        reason: 'Personal',
      })
      .set('X-User-Email', 'alice@shaavir.com');
    return res.body.leave.id;
  }

  // ── Helper: create a pending regularization ──

  async function createPendingReg(): Promise<string> {
    await db.run(
      `INSERT INTO attendance_daily (email, name, date, status, first_in, total_worked_minutes, is_late, late_minutes, group_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'alice@shaavir.com',
        'Alice',
        '2026-03-20',
        'out',
        '2026-03-20T10:00:00.000Z',
        480,
        0,
        0,
        'engineering',
      ],
    );
    const res = await request(app)
      .post('/api/regularizations')
      .send({
        email: 'alice@shaavir.com',
        name: 'Alice',
        date: '2026-03-20',
        correctionType: 'clock-in',
        inTime: '09:00',
        reason: 'Badge error',
      })
      .set('X-User-Email', 'alice@shaavir.com');
    return res.body.regularization.id;
  }

  // ── Helper: create a pending BD meeting ──

  async function createPendingBdMeeting(): Promise<string> {
    const res = await request(app)
      .post('/api/bd-meetings')
      .send({
        email: 'bob@shaavir.com',
        name: 'Bob BD',
        client: 'Acme',
        date: '2026-04-10',
      })
      .set('X-User-Email', 'bob@shaavir.com');
    return res.body.meeting.id;
  }

  // ═══════════════════════════════════════════════════════════════
  //  Teams receiver
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/interactions/teams', () => {
    it('dispatches leave.approve from Teams invoke', async () => {
      const leaveId = await createPendingLeave();

      const res = await request(app)
        .post('/api/interactions/teams')
        .send({
          type: 'invoke',
          value: { verb: 'leave.approve', leaveId, action: 'approve' },
          from: { aadObjectId: '', name: 'Manager' },
        });
      expect(res.status).toBe(200);
      expect(res.body.value).toMatch(/approved/i);
    });

    it('passes through non-invoke messages', async () => {
      const res = await request(app)
        .post('/api/interactions/teams')
        .send({ type: 'message', text: 'hello' });
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Slack receiver
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/interactions/slack', () => {
    it('dispatches leave.approve from Slack block_actions', async () => {
      const leaveId = await createPendingLeave();

      const payload = JSON.stringify({
        type: 'block_actions',
        user: { id: 'U123', name: 'Manager' },
        actions: [
          {
            action_id: 'leave.approve',
            value: JSON.stringify({ leaveId, action: 'approve' }),
          },
        ],
      });

      const res = await request(app).post('/api/interactions/slack').type('form').send({ payload });
      expect(res.status).toBe(200);
      expect(res.body.text).toMatch(/approved/i);
    });

    it('handles missing payload gracefully', async () => {
      const res = await request(app).post('/api/interactions/slack').send({});
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Google Chat receiver
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/interactions/google-chat', () => {
    it('dispatches reg.approve from Google Chat card click', async () => {
      const regId = await createPendingReg();

      const res = await request(app)
        .post('/api/interactions/google-chat')
        .send({
          type: 'CARD_CLICKED',
          action: {
            actionMethodName: 'reg.approve',
            parameters: [
              { key: 'regId', value: regId },
              { key: 'action', value: 'approve' },
            ],
          },
          user: { email: 'mgr@shaavir.com' },
        });
      expect(res.status).toBe(200);
      expect(res.body.text).toMatch(/approved/i);
    });

    it('handles non-card-click events', async () => {
      const res = await request(app)
        .post('/api/interactions/google-chat')
        .send({ type: 'MESSAGE', message: { text: 'hello' } });
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Discord receiver
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/interactions/discord', () => {
    it('responds to PING with type 1', async () => {
      const res = await request(app).post('/api/interactions/discord').send({ type: 1 });
      expect(res.body.type).toBe(1);
    });

    it('dispatches bd_meeting.qualify from button click', async () => {
      const meetingId = await createPendingBdMeeting();

      const res = await request(app)
        .post('/api/interactions/discord')
        .send({
          type: 3,
          data: {
            custom_id: JSON.stringify({ action: 'bd_meeting.qualify', meetingId }),
            component_type: 2,
          },
          member: { user: { id: '123', username: 'mgr' } },
        });
      expect(res.status).toBe(200);
      expect(res.body.data.content).toMatch(/qualified/i);
    });

    it('handles missing custom_id', async () => {
      const res = await request(app).post('/api/interactions/discord').send({ type: 3, data: {} });
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Telegram receiver
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/interactions/telegram', () => {
    it('dispatches leave.reject from callback_query', async () => {
      const leaveId = await createPendingLeave();

      const res = await request(app)
        .post('/api/interactions/telegram')
        .send({
          callback_query: {
            id: 'cb123',
            data: JSON.stringify({ a: 'leave.reject', leaveId, reason: 'Not justified' }),
            from: { id: 999, username: 'mgr' },
          },
        });
      expect(res.status).toBe(200);
    });

    it('handles missing callback_query', async () => {
      const res = await request(app)
        .post('/api/interactions/telegram')
        .send({ message: { text: 'hello' } });
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  WhatsApp receiver
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/interactions/whatsapp', () => {
    it('dispatches from interactive button reply', async () => {
      const leaveId = await createPendingLeave();

      const res = await request(app)
        .post('/api/interactions/whatsapp')
        .send({
          entry: [
            {
              changes: [
                {
                  value: {
                    messages: [
                      {
                        from: '919876543210',
                        interactive: {
                          button_reply: {
                            id: JSON.stringify({ action: 'leave.approve', leaveId }),
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        });
      expect(res.status).toBe(200);
    });

    it('handles messages without interactive buttons', async () => {
      const res = await request(app)
        .post('/api/interactions/whatsapp')
        .send({ entry: [{ changes: [{ value: { messages: [{ text: 'hello' }] } }] }] });
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  ClickUp receiver
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/interactions/clickup', () => {
    it('logs task status change', async () => {
      const res = await request(app)
        .post('/api/interactions/clickup')
        .send({
          event: 'taskStatusUpdated',
          task_id: 'task-123',
          history_items: [{ field: 'status', after: { status: 'Approved' } }],
        });
      expect(res.status).toBe(200);
    });

    it('ignores non-status events', async () => {
      const res = await request(app)
        .post('/api/interactions/clickup')
        .send({ event: 'taskCreated', task_id: 'task-456' });
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Email signed action links
  // ═══════════════════════════════════════════════════════════════

  describe('GET /api/actions/:token — email action links', () => {
    it('executes a valid signed leave approve action', async () => {
      const leaveId = await createPendingLeave();

      const token = signActionToken(
        {
          entityType: 'leave',
          entityId: leaveId,
          action: 'approve',
          approverEmail: 'mgr@shaavir.com',
        },
        ACTION_SECRET,
      );

      const res = await request(app).get(`/api/actions/${token}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('Action Complete');
      expect(res.text).toContain('approved');
    });

    it('executes a valid signed reg approve action', async () => {
      const regId = await createPendingReg();

      const token = signActionToken(
        {
          entityType: 'regularization',
          entityId: regId,
          action: 'approve',
          approverEmail: 'mgr@shaavir.com',
        },
        ACTION_SECRET,
      );

      const res = await request(app).get(`/api/actions/${token}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('approved');
    });

    it('rejects expired token with 410', async () => {
      const token = signExpiredToken(
        {
          entityType: 'leave',
          entityId: 'xxx',
          action: 'approve',
          approverEmail: 'mgr@shaavir.com',
        },
        ACTION_SECRET,
      );

      const res = await request(app).get(`/api/actions/${token}`);
      expect(res.status).toBe(410);
      expect(res.body.error).toMatch(/expired/i);
    });

    it('rejects tampered HMAC with 403', async () => {
      const payload = {
        entityType: 'leave',
        entityId: 'xxx',
        action: 'approve',
        approverEmail: 'mgr@shaavir.com',
        exp: Date.now() + 999999,
      };
      const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const badHmac = 'tampered_hmac_value_here';

      const res = await request(app).get(`/api/actions/${encoded}.${badHmac}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/signature/i);
    });

    it('rejects malformed token without dot separator', async () => {
      const res = await request(app).get('/api/actions/nodotsintoken');
      expect(res.status).toBe(400);
    });

    it('rejects unknown entity type', async () => {
      const token = signActionToken(
        {
          entityType: 'unknown',
          entityId: 'xxx',
          action: 'approve',
          approverEmail: 'mgr@shaavir.com',
        },
        ACTION_SECRET,
      );

      const res = await request(app).get(`/api/actions/${token}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Uu]nknown/);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Dispatcher edge cases
  // ═══════════════════════════════════════════════════════════════

  describe('Action dispatcher edge cases', () => {
    it('returns error for unknown action ID via Teams', async () => {
      const res = await request(app)
        .post('/api/interactions/teams')
        .send({
          type: 'invoke',
          value: { verb: 'unknown.action', data: {} },
          from: { aadObjectId: '' },
        });
      expect(res.status).toBe(200);
      expect(res.body.value).toMatch(/[Uu]nknown/);
    });

    it('dispatches BD meeting full flow: qualify then approve via Slack', async () => {
      const meetingId = await createPendingBdMeeting();

      // Qualify via Slack
      const qualPayload = JSON.stringify({
        type: 'block_actions',
        user: { id: 'U456' },
        actions: [{ action_id: 'bd_meeting.qualify', value: JSON.stringify({ meetingId }) }],
      });
      const q = await request(app)
        .post('/api/interactions/slack')
        .type('form')
        .send({ payload: qualPayload });
      expect(q.body.text).toMatch(/qualified/i);

      // Approve via Slack
      const appPayload = JSON.stringify({
        type: 'block_actions',
        user: { id: 'U789' },
        actions: [{ action_id: 'bd_meeting.approve', value: JSON.stringify({ meetingId }) }],
      });
      const a = await request(app)
        .post('/api/interactions/slack')
        .type('form')
        .send({ payload: appPayload });
      expect(a.body.text).toMatch(/approved/i);

      // Verify final status
      const list = await request(app)
        .get('/api/bd-meetings?email=bob@shaavir.com')
        .set('X-User-Email', 'bob@shaavir.com');
      expect(list.body.meetings[0].status).toBe('approved');
    });
  });
});
