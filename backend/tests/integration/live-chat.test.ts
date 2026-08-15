import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Live Chat / Feed Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  const ALICE = 'alice@shaavir.com';
  const BOB = 'bob@shaavir.com';

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;

    await seedMember(db, {
      email: ALICE,
      name: 'Alice',
      groupId: 'engineering',
      groupName: 'Engineering',
      groupShiftStart: '09:00',
      groupShiftEnd: '18:00',
    });
    await seedMember(db, {
      email: BOB,
      name: 'Bob',
      groupId: 'sales',
      groupName: 'Sales',
      groupShiftStart: '09:00',
      groupShiftEnd: '18:00',
    });
  });

  afterEach(async () => {
    await db.close();
  });

  // ── Channels ──

  describe('Channel management', () => {
    it('lists channels including seeded company feed', async () => {
      const res = await request(app).get(`/api/channels?email=${ALICE}`);
      expect(res.status).toBe(200);
      const names = res.body.channels.map((c: Record<string, unknown>) => c.id);
      expect(names).toContain('company-feed');
    });

    it('creates a custom channel', async () => {
      const res = await request(app)
        .post('/api/channels')
        .send({ name: 'Water Cooler', createdBy: ALICE, description: 'Casual chat' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Water Cooler');
      expect(res.body.type).toBe('custom');
    });

    it('creates a department channel with auto-membership', async () => {
      const res = await request(app)
        .post('/api/channels')
        .send({ name: 'Engineering Chat', type: 'department', groupId: 'engineering', createdBy: ALICE });

      expect(res.status).toBe(201);

      const members = await request(app).get(`/api/channels/${res.body.id}/members`);
      const emails = members.body.members.map((m: Record<string, unknown>) => m.email);
      expect(emails).toContain(ALICE);
    });

    it('gets channel by id', async () => {
      const res = await request(app).get('/api/channels/company-feed');
      expect(res.status).toBe(200);
      expect(res.body.type).toBe('company');
    });

    it('returns 404 for nonexistent channel', async () => {
      const res = await request(app).get('/api/channels/nonexistent');
      expect(res.status).toBe(404);
    });

    it('updates a channel', async () => {
      const create = await request(app)
        .post('/api/channels')
        .send({ name: 'Old', createdBy: ALICE });

      await request(app)
        .put(`/api/channels/${create.body.id}`)
        .send({ name: 'New Name' });

      const get = await request(app).get(`/api/channels/${create.body.id}`);
      expect(get.body.name).toBe('New Name');
    });

    it('archives a custom channel', async () => {
      const create = await request(app)
        .post('/api/channels')
        .send({ name: 'Temp', createdBy: ALICE });

      const res = await request(app).post(`/api/channels/${create.body.id}/archive`);
      expect(res.status).toBe(200);
    });

    it('cannot archive the company channel', async () => {
      const res = await request(app).post('/api/channels/company-feed/archive');
      expect(res.status).toBe(400);
    });
  });

  // ── Membership ──

  describe('Channel membership', () => {
    it('joins and leaves a channel', async () => {
      const create = await request(app)
        .post('/api/channels')
        .send({ name: 'Club', createdBy: ALICE });

      // Bob joins
      const join = await request(app)
        .post(`/api/channels/${create.body.id}/join`)
        .send({ email: BOB });
      expect(join.status).toBe(200);

      const members = await request(app).get(`/api/channels/${create.body.id}/members`);
      const emails = members.body.members.map((m: Record<string, unknown>) => m.email);
      expect(emails).toContain(BOB);

      // Bob leaves
      const leave = await request(app)
        .post(`/api/channels/${create.body.id}/leave`)
        .send({ email: BOB });
      expect(leave.status).toBe(200);

      const after = await request(app).get(`/api/channels/${create.body.id}/members`);
      const afterEmails = after.body.members.map((m: Record<string, unknown>) => m.email);
      expect(afterEmails).not.toContain(BOB);
    });

    it('cannot leave the company channel', async () => {
      const res = await request(app)
        .post('/api/channels/company-feed/leave')
        .send({ email: ALICE });
      expect(res.status).toBe(400);
    });
  });

  // ── Feed Messages ──

  describe('Channel messages', () => {
    it('posts and retrieves a message', async () => {
      const post = await request(app)
        .post('/api/channels/company-feed/messages')
        .send({ email: ALICE, content: 'Hello everyone!' });

      expect(post.status).toBe(201);
      expect(post.body.content).toBe('Hello everyone!');
      expect(post.body.sender_email).toBe(ALICE);

      const msgs = await request(app).get('/api/channels/company-feed/messages');
      expect(msgs.body.messages).toHaveLength(1);
    });

    it('rejects empty content', async () => {
      const res = await request(app)
        .post('/api/channels/company-feed/messages')
        .send({ email: ALICE, content: '' });
      expect(res.status).toBe(400);
    });

    it('non-member cannot post to custom channel', async () => {
      const create = await request(app)
        .post('/api/channels')
        .send({ name: 'Private', createdBy: ALICE });

      const res = await request(app)
        .post(`/api/channels/${create.body.id}/messages`)
        .send({ email: BOB, content: 'Trying to sneak in' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not a member');
    });

    it('edits own message', async () => {
      const post = await request(app)
        .post('/api/channels/company-feed/messages')
        .send({ email: ALICE, content: 'Typo' });

      const edit = await request(app)
        .put(`/api/messages/${post.body.id}`)
        .send({ email: ALICE, content: 'Fixed' });
      expect(edit.status).toBe(200);
    });

    it('cannot edit someone else\'s message', async () => {
      const post = await request(app)
        .post('/api/channels/company-feed/messages')
        .send({ email: ALICE, content: 'My message' });

      const edit = await request(app)
        .put(`/api/messages/${post.body.id}`)
        .send({ email: BOB, content: 'Hijack' });
      expect(edit.status).toBe(400);
    });

    it('deletes own message', async () => {
      const post = await request(app)
        .post('/api/channels/company-feed/messages')
        .send({ email: ALICE, content: 'Delete me' });

      const del = await request(app)
        .delete(`/api/messages/${post.body.id}?email=${ALICE}`);
      expect(del.status).toBe(200);

      const msgs = await request(app).get('/api/channels/company-feed/messages');
      expect(msgs.body.messages).toHaveLength(0);
    });

    it('pins and retrieves pinned messages', async () => {
      const post = await request(app)
        .post('/api/channels/company-feed/messages')
        .send({ email: ALICE, content: 'Important!' });

      await request(app)
        .post(`/api/messages/${post.body.id}/pin`)
        .send({ pin: true });

      const pinned = await request(app).get('/api/channels/company-feed/pinned');
      expect(pinned.body.messages).toHaveLength(1);
      expect(pinned.body.messages[0].pinned).toBe(1);
    });

    it('tracks read status and unread count', async () => {
      // Alice posts
      const post = await request(app)
        .post('/api/channels/company-feed/messages')
        .send({ email: ALICE, content: 'Read me' });

      // Bob has 1 unread
      const unread = await request(app).get(`/api/channels/company-feed/unread?email=${BOB}`);
      expect(unread.body.unread).toBe(1);

      // Bob reads it
      await request(app)
        .post(`/api/messages/${post.body.id}/read`)
        .send({ email: BOB });

      const after = await request(app).get(`/api/channels/company-feed/unread?email=${BOB}`);
      expect(after.body.unread).toBe(0);
    });

    it('supports pagination with limit', async () => {
      // Post 5 messages
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/channels/company-feed/messages')
          .send({ email: ALICE, content: `Message ${i}` });
      }

      const page1 = await request(app).get('/api/channels/company-feed/messages?limit=3');
      expect(page1.body.messages).toHaveLength(3);

      const page2 = await request(app).get('/api/channels/company-feed/messages?limit=10');
      expect(page2.body.messages).toHaveLength(5);
    });
  });

  // ── Direct Messages ──

  describe('Direct Messages', () => {
    it('sends and retrieves a DM', async () => {
      const send = await request(app)
        .post('/api/dm')
        .send({ senderEmail: ALICE, recipientEmail: BOB, content: 'Hey Bob!' });

      expect(send.status).toBe(201);
      expect(send.body.sender_email).toBe(ALICE);
      expect(send.body.recipient_email).toBe(BOB);

      const conv = await request(app).get(`/api/dm/${BOB}?myEmail=${ALICE}`);
      expect(conv.body.messages).toHaveLength(1);
      expect(conv.body.messages[0].content).toBe('Hey Bob!');
    });

    it('cannot DM yourself', async () => {
      const res = await request(app)
        .post('/api/dm')
        .send({ senderEmail: ALICE, recipientEmail: ALICE, content: 'Me me me' });
      expect(res.status).toBe(400);
    });

    it('cannot DM nonexistent user', async () => {
      const res = await request(app)
        .post('/api/dm')
        .send({ senderEmail: ALICE, recipientEmail: 'nobody@shaavir.com', content: 'Hello?' });
      expect(res.status).toBe(400);
    });

    it('tracks unread DMs', async () => {
      await request(app)
        .post('/api/dm')
        .send({ senderEmail: ALICE, recipientEmail: BOB, content: 'Msg 1' });
      await request(app)
        .post('/api/dm')
        .send({ senderEmail: ALICE, recipientEmail: BOB, content: 'Msg 2' });

      const unread = await request(app).get(`/api/dm/unread?email=${BOB}`);
      expect(unread.body.unread).toBe(2);

      // Mark read
      await request(app)
        .post(`/api/dm/${ALICE}/read`)
        .send({ email: BOB });

      const after = await request(app).get(`/api/dm/unread?email=${BOB}`);
      expect(after.body.unread).toBe(0);
    });

    it('lists DM contacts', async () => {
      await request(app)
        .post('/api/dm')
        .send({ senderEmail: ALICE, recipientEmail: BOB, content: 'Hi' });

      const contacts = await request(app).get(`/api/dm/contacts?email=${ALICE}`);
      expect(contacts.body.contacts).toHaveLength(1);
      expect(contacts.body.contacts[0].email).toBe(BOB);
    });

    it('rejects empty DM content', async () => {
      const res = await request(app)
        .post('/api/dm')
        .send({ senderEmail: ALICE, recipientEmail: BOB, content: '  ' });
      expect(res.status).toBe(400);
    });
  });
});
