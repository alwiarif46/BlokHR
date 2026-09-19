import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Tracked Meetings - Tenant Isolation & Security', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;


    await seedMember(db, { email: 'user1@t1.com', name: 'User1' });
    await db.run('UPDATE members SET tenant_id = ? WHERE email = ?', ['t1', 'user1@t1.com']);
    await seedMember(db, { email: 'user2@t1.com', name: 'User2' });
    await db.run('UPDATE members SET tenant_id = ? WHERE email = ?', ['t1', 'user2@t1.com']);

    await seedMember(db, { email: 'user3@t2.com', name: 'User3' });
    await db.run('UPDATE members SET tenant_id = ? WHERE email = ?', ['t2', 'user3@t2.com']);
  });

  afterEach(async () => {
    await db.close();
  });

  async function createMeeting() {
    const res = await request(app)
      .post('/api/meetings')
      .send({ name: 'T1 Meeting', date: '2026-10-10' })
      .set('X-User-Email', 'user1@t1.com')
      .set('X-Blok-Tenant', 't1').set('X-Blok-Internal', 'test-internal-secret');
    if (!res.body.meeting) console.error('MEET CREATE ERR', res.body); return res.body.meeting.id;
  }

  it('owner tracked-meeting delete', async () => {
    const id = await createMeeting();
    const res = await request(app).delete('/api/meetings/' + id)
      .set('X-User-Email', 'user1@t1.com')
      .set('X-Blok-Tenant', 't1').set('X-Blok-Internal', 'test-internal-secret');
    expect(res.body.success).toBe(true);
  });

  it('unauthorized tracked-meeting delete', async () => {
    const id = await createMeeting();
    const res = await request(app).delete('/api/meetings/' + id)
      .set('X-User-Email', 'user2@t1.com') // same tenant, not owner
      .set('X-Blok-Tenant', 't1').set('X-Blok-Internal', 'test-internal-secret');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/You can only delete meetings you created/);
  });

  it('cross-tenant tracked-meeting get/update/delete', async () => {
    const id = await createMeeting();
    // GET
    const resGet = await request(app).get('/api/meetings/' + id)
      .set('X-User-Email', 'user3@t2.com')
      .set('X-Blok-Tenant', 't2').set('X-Blok-Internal', 'test-internal-secret');
    expect(resGet.status).toBe(404);
    
    // UPDATE
    const resUpdate = await request(app).put('/api/meetings/' + id)
      .send({ name: 'Hacked' })
      .set('X-User-Email', 'user3@t2.com')
      .set('X-Blok-Tenant', 't2').set('X-Blok-Internal', 'test-internal-secret');
    expect(resUpdate.status).toBe(400);

    // DELETE
    const resDelete = await request(app).delete('/api/meetings/' + id)
      .set('X-User-Email', 'user3@t2.com')
      .set('X-Blok-Tenant', 't2').set('X-Blok-Internal', 'test-internal-secret');
    expect(resDelete.status).toBe(404);
  });

  it('cross-tenant attendance access', async () => {
    const id = await createMeeting();
    
    // T2 user tries to sync attendance for T1 meeting
    const resSync = await request(app).post('/api/meetings/' + id + '/attendance')
      .send({ action: 'sync', attendees: [] })
      .set('X-User-Email', 'user3@t2.com')
      .set('X-Blok-Tenant', 't2').set('X-Blok-Internal', 'test-internal-secret');
    expect(resSync.status).toBe(404);

    // T2 user tries to get attendance
    const resGet = await request(app).get('/api/meetings/' + id + '/attendance')
      .set('X-User-Email', 'user3@t2.com')
      .set('X-Blok-Tenant', 't2').set('X-Blok-Internal', 'test-internal-secret');
    expect(resGet.status).toBe(404); // Not found!
  });
});
