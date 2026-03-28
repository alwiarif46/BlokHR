import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('BD Meeting Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    // Seed a BD department member
    await seedMember(db, {
      email: 'bob@shaavir.com',
      name: 'Bob BD',
      groupId: 'bd',
      groupName: 'Business Development',
      groupShiftStart: '09:00',
      groupShiftEnd: '18:00',
    });
    // Seed a non-BD member for rejection tests
    await seedMember(db, {
      email: 'alice@shaavir.com',
      name: 'Alice Eng',
      groupId: 'engineering',
      groupName: 'Engineering',
      groupShiftStart: '09:00',
      groupShiftEnd: '18:00',
    });
  });

  afterEach(async () => {
    await db.close();
  });

  // ── Submission ──

  describe('POST /api/bd-meetings', () => {
    it('submits a BD meeting request for a BD member', async () => {
      const res = await request(app)
        .post('/api/bd-meetings')
        .send({
          email: 'bob@shaavir.com',
          name: 'Bob BD',
          client: 'Acme Corp',
          date: '2026-03-25',
          time: '14:00',
          location: 'Client Office',
          notes: 'Discuss Q2 proposal',
        })
        .set('X-User-Email', 'bob@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meeting.status).toBe('pending');
      expect(res.body.meeting.client).toBe('Acme Corp');
      expect(res.body.meeting.email).toBe('bob@shaavir.com');
    });

    it('rejects non-BD department members', async () => {
      const res = await request(app)
        .post('/api/bd-meetings')
        .send({
          email: 'alice@shaavir.com',
          name: 'Alice Eng',
          client: 'Some Client',
          date: '2026-03-25',
        })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Business Development/);
    });

    it('rejects missing email', async () => {
      const res = await request(app)
        .post('/api/bd-meetings')
        .send({ client: 'Acme', date: '2026-03-25' })
        .set('X-User-Email', 'bob@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects missing date', async () => {
      const res = await request(app)
        .post('/api/bd-meetings')
        .send({ email: 'bob@shaavir.com', client: 'Acme' })
        .set('X-User-Email', 'bob@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects missing client', async () => {
      const res = await request(app)
        .post('/api/bd-meetings')
        .send({ email: 'bob@shaavir.com', date: '2026-03-25' })
        .set('X-User-Email', 'bob@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Cc]lient/);
    });

    it('rejects unknown email (not in members table)', async () => {
      const res = await request(app)
        .post('/api/bd-meetings')
        .send({
          email: 'nobody@shaavir.com',
          client: 'Acme',
          date: '2026-03-25',
        })
        .set('X-User-Email', 'nobody@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Business Development/);
    });
  });

  // ── Fetch ──

  describe('GET /api/bd-meetings', () => {
    it('returns empty when no meetings exist', async () => {
      const res = await request(app)
        .get('/api/bd-meetings?email=bob@shaavir.com')
        .set('X-User-Email', 'bob@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.meetings).toEqual([]);
    });

    it('returns submitted meetings', async () => {
      await request(app)
        .post('/api/bd-meetings')
        .send({
          email: 'bob@shaavir.com',
          name: 'Bob BD',
          client: 'Acme Corp',
          date: '2026-03-25',
          time: '14:00',
          notes: 'Discuss proposal',
        })
        .set('X-User-Email', 'bob@shaavir.com');

      const res = await request(app)
        .get('/api/bd-meetings?email=bob@shaavir.com')
        .set('X-User-Email', 'bob@shaavir.com');
      expect(res.body.meetings).toHaveLength(1);
      expect(res.body.meetings[0].client).toBe('Acme Corp');
    });

    it('rejects missing email query param', async () => {
      const res = await request(app).get('/api/bd-meetings').set('X-User-Email', 'bob@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  // ── Qualify → Approve flow ──

  describe('Qualify/Approve flow', () => {
    let meetingId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/bd-meetings')
        .send({
          email: 'bob@shaavir.com',
          name: 'Bob BD',
          client: 'Acme Corp',
          date: '2026-03-25',
          time: '10:00',
          location: 'HQ',
          notes: 'Initial pitch',
        })
        .set('X-User-Email', 'bob@shaavir.com');
      meetingId = res.body.meeting.id;
    });

    it('qualifies a pending meeting: pending → qualified', async () => {
      const res = await request(app)
        .post('/api/bd-meetings/qualify')
        .send({ meetingId, approverEmail: 'mgr@shaavir.com' })
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(res.body.success).toBe(true);

      const list = await request(app)
        .get('/api/bd-meetings?email=bob@shaavir.com')
        .set('X-User-Email', 'bob@shaavir.com');
      expect(list.body.meetings[0].status).toBe('qualified');
      expect(list.body.meetings[0].qualifier_email).toBe('mgr@shaavir.com');
    });

    it('approves after qualification: qualified → approved', async () => {
      await request(app)
        .post('/api/bd-meetings/qualify')
        .send({ meetingId, approverEmail: 'mgr@shaavir.com' })
        .set('X-User-Email', 'mgr@shaavir.com');

      const res = await request(app)
        .post('/api/bd-meetings/approve')
        .send({ meetingId, approverEmail: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);

      const list = await request(app)
        .get('/api/bd-meetings?email=bob@shaavir.com')
        .set('X-User-Email', 'bob@shaavir.com');
      expect(list.body.meetings[0].status).toBe('approved');
      expect(list.body.meetings[0].approver_email).toBe('admin@shaavir.com');
    });

    it('rejects approve before qualify', async () => {
      const res = await request(app)
        .post('/api/bd-meetings/approve')
        .send({ meetingId, approverEmail: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot approve/);
    });

    it('rejects double qualification', async () => {
      await request(app)
        .post('/api/bd-meetings/qualify')
        .send({ meetingId, approverEmail: 'mgr@shaavir.com' })
        .set('X-User-Email', 'mgr@shaavir.com');

      const res = await request(app)
        .post('/api/bd-meetings/qualify')
        .send({ meetingId, approverEmail: 'mgr2@shaavir.com' })
        .set('X-User-Email', 'mgr2@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot qualify/);
    });

    it('rejects double approval', async () => {
      await request(app)
        .post('/api/bd-meetings/qualify')
        .send({ meetingId, approverEmail: 'mgr@shaavir.com' })
        .set('X-User-Email', 'mgr@shaavir.com');
      await request(app)
        .post('/api/bd-meetings/approve')
        .send({ meetingId, approverEmail: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post('/api/bd-meetings/approve')
        .send({ meetingId, approverEmail: 'admin2@shaavir.com' })
        .set('X-User-Email', 'admin2@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot approve/);
    });

    it('rejects qualify with missing meetingId', async () => {
      const res = await request(app)
        .post('/api/bd-meetings/qualify')
        .send({ approverEmail: 'mgr@shaavir.com' })
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/meetingId/);
    });

    it('rejects approve with missing meetingId', async () => {
      const res = await request(app)
        .post('/api/bd-meetings/approve')
        .send({ approverEmail: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/meetingId/);
    });

    it('returns not found for nonexistent meeting qualify', async () => {
      const res = await request(app)
        .post('/api/bd-meetings/qualify')
        .send({ meetingId: 'nonexistent-id', approverEmail: 'mgr@shaavir.com' })
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not found/);
    });

    it('returns not found for nonexistent meeting approve', async () => {
      const res = await request(app)
        .post('/api/bd-meetings/approve')
        .send({ meetingId: 'nonexistent-id', approverEmail: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not found/);
    });
  });

  // ── Rejection ──

  describe('POST /api/bd-meetings/reject', () => {
    it('rejects a pending meeting with reason', async () => {
      const sub = await request(app)
        .post('/api/bd-meetings')
        .send({
          email: 'bob@shaavir.com',
          name: 'Bob BD',
          client: 'Acme Corp',
          date: '2026-03-25',
        })
        .set('X-User-Email', 'bob@shaavir.com');

      const res = await request(app)
        .post('/api/bd-meetings/reject')
        .send({
          meetingId: sub.body.meeting.id,
          approverEmail: 'mgr@shaavir.com',
          reason: 'Client not qualified',
        })
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(res.body.success).toBe(true);

      const list = await request(app)
        .get('/api/bd-meetings?email=bob@shaavir.com')
        .set('X-User-Email', 'bob@shaavir.com');
      expect(list.body.meetings[0].status).toBe('rejected');
      expect(list.body.meetings[0].rejection_reason).toBe('Client not qualified');
    });

    it('rejects a qualified meeting', async () => {
      const sub = await request(app)
        .post('/api/bd-meetings')
        .send({
          email: 'bob@shaavir.com',
          name: 'Bob BD',
          client: 'Acme Corp',
          date: '2026-03-25',
        })
        .set('X-User-Email', 'bob@shaavir.com');

      await request(app)
        .post('/api/bd-meetings/qualify')
        .send({ meetingId: sub.body.meeting.id, approverEmail: 'mgr@shaavir.com' })
        .set('X-User-Email', 'mgr@shaavir.com');

      const res = await request(app)
        .post('/api/bd-meetings/reject')
        .send({
          meetingId: sub.body.meeting.id,
          approverEmail: 'admin@shaavir.com',
          reason: 'Budget constraints',
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);

      const list = await request(app)
        .get('/api/bd-meetings?email=bob@shaavir.com')
        .set('X-User-Email', 'bob@shaavir.com');
      expect(list.body.meetings[0].status).toBe('rejected');
    });

    it('cannot reject an already approved meeting', async () => {
      const sub = await request(app)
        .post('/api/bd-meetings')
        .send({
          email: 'bob@shaavir.com',
          name: 'Bob BD',
          client: 'Acme Corp',
          date: '2026-03-25',
        })
        .set('X-User-Email', 'bob@shaavir.com');

      await request(app)
        .post('/api/bd-meetings/qualify')
        .send({ meetingId: sub.body.meeting.id, approverEmail: 'mgr@shaavir.com' })
        .set('X-User-Email', 'mgr@shaavir.com');
      await request(app)
        .post('/api/bd-meetings/approve')
        .send({ meetingId: sub.body.meeting.id, approverEmail: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post('/api/bd-meetings/reject')
        .send({
          meetingId: sub.body.meeting.id,
          approverEmail: 'mgr@shaavir.com',
          reason: 'Changed mind',
        })
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot reject/);
    });

    it('cannot reject an already rejected meeting', async () => {
      const sub = await request(app)
        .post('/api/bd-meetings')
        .send({
          email: 'bob@shaavir.com',
          name: 'Bob BD',
          client: 'Acme Corp',
          date: '2026-03-25',
        })
        .set('X-User-Email', 'bob@shaavir.com');

      await request(app)
        .post('/api/bd-meetings/reject')
        .send({
          meetingId: sub.body.meeting.id,
          approverEmail: 'mgr@shaavir.com',
          reason: 'Nope',
        })
        .set('X-User-Email', 'mgr@shaavir.com');

      const res = await request(app)
        .post('/api/bd-meetings/reject')
        .send({
          meetingId: sub.body.meeting.id,
          approverEmail: 'mgr@shaavir.com',
          reason: 'Double nope',
        })
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot reject/);
    });

    it('rejects with missing meetingId', async () => {
      const res = await request(app)
        .post('/api/bd-meetings/reject')
        .send({ approverEmail: 'mgr@shaavir.com', reason: 'test' })
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/meetingId/);
    });

    it('returns not found for nonexistent meeting reject', async () => {
      const res = await request(app)
        .post('/api/bd-meetings/reject')
        .send({ meetingId: 'nonexistent-id', approverEmail: 'mgr@shaavir.com', reason: 'test' })
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not found/);
    });
  });

  // ── Edge cases ──

  describe('Edge cases', () => {
    it('handles empty notes, time, and location gracefully', async () => {
      const res = await request(app)
        .post('/api/bd-meetings')
        .send({
          email: 'bob@shaavir.com',
          name: 'Bob BD',
          client: 'Minimal Corp',
          date: '2026-03-26',
        })
        .set('X-User-Email', 'bob@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.meeting.time).toBe('');
      expect(res.body.meeting.location).toBe('');
      expect(res.body.meeting.notes).toBe('');
    });

    it('normalizes email to lowercase', async () => {
      const res = await request(app)
        .post('/api/bd-meetings')
        .send({
          email: 'BOB@Shaavir.com',
          name: 'Bob BD',
          client: 'Case Test Corp',
          date: '2026-03-26',
        })
        .set('X-User-Email', 'bob@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.meeting.email).toBe('bob@shaavir.com');
    });

    it('trims client name whitespace', async () => {
      const res = await request(app)
        .post('/api/bd-meetings')
        .send({
          email: 'bob@shaavir.com',
          name: 'Bob BD',
          client: '  Acme Corp  ',
          date: '2026-03-26',
        })
        .set('X-User-Email', 'bob@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.meeting.client).toBe('Acme Corp');
    });

    it('uses identity email as fallback for qualifier', async () => {
      const sub = await request(app)
        .post('/api/bd-meetings')
        .send({
          email: 'bob@shaavir.com',
          name: 'Bob BD',
          client: 'Fallback Test',
          date: '2026-03-26',
        })
        .set('X-User-Email', 'bob@shaavir.com');

      const res = await request(app)
        .post('/api/bd-meetings/qualify')
        .send({ meetingId: sub.body.meeting.id })
        .set('X-User-Email', 'mgr@shaavir.com');
      expect(res.body.success).toBe(true);

      const list = await request(app)
        .get('/api/bd-meetings?email=bob@shaavir.com')
        .set('X-User-Email', 'bob@shaavir.com');
      expect(list.body.meetings[0].qualifier_email).toBe('mgr@shaavir.com');
    });
  });
});
