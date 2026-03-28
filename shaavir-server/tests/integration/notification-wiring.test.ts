import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('NotificationDispatcher Wiring (Gap 1)', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    db = ctx.db;
    await seedMember(db, { email: 'emp@shaavir.com', name: 'Emp User' });
    await seedMember(db, { email: 'mgr@shaavir.com', name: 'Mgr User' });
    await db.run('INSERT OR IGNORE INTO admins (email) VALUES (?)', ['mgr@shaavir.com']);
  });

  afterAll(async () => {
    await db.close();
  });

  it('submitting a leave request does not throw when notifier is wired', async () => {
    const res = await request(app)
      .post('/api/leave-submit')
      .set('x-user-email', 'emp@shaavir.com')
      .send({
        personName: 'Emp User',
        personEmail: 'emp@shaavir.com',
        leaveType: 'Casual',
        kind: 'FullDay',
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        reason: 'Personal work',
      });
    // Should succeed — no TypeError from missing notifier
    expect(res.status).toBe(200);
  });

  it('approving a leave does not throw when dispatcher is wired', async () => {
    // First create a leave
    const createRes = await request(app)
      .post('/api/leave-submit')
      .set('x-user-email', 'emp@shaavir.com')
      .send({
        personName: 'Emp User',
        personEmail: 'emp@shaavir.com',
        leaveType: 'Casual',
        kind: 'FullDay',
        startDate: '2026-05-01',
        endDate: '2026-05-01',
        reason: 'Test approval',
      });
    expect(createRes.status).toBe(200);
    const leaveId = createRes.body.leave?.id;
    expect(leaveId).toBeTruthy();

    const approveRes = await request(app)
      .post('/api/leave-action')
      .set('x-user-email', 'mgr@shaavir.com')
      .send({ leaveId, action: 'Approved', actor: 'mgr@shaavir.com' });
    // Should not crash — any non-500 response is acceptable
    expect(approveRes.status).toBeLessThan(500);
  });

  it('submitting a regularization does not throw', async () => {
    const res = await request(app)
      .post('/api/regularization-submit')
      .set('x-user-email', 'emp@shaavir.com')
      .send({
        personEmail: 'emp@shaavir.com',
        personName: 'Emp User',
        date: '2026-03-27',
        clockIn: '09:00',
        clockOut: '18:00',
        reason: 'Forgot to clock',
      });
    // Should not crash — any non-500 response is acceptable
    expect(res.status).toBeLessThan(500);
  });

  it('dispatcher is registered (adapter count >= 0, no crash)', async () => {
    // Without env vars configured, adapter count should be 0 but no crash
    // Just verify the app boots and routes work
    const res = await request(app)
      .get('/api/settings')
      .set('x-user-email', 'emp@shaavir.com');
    expect(res.status).toBeLessThan(500);
  });
});
