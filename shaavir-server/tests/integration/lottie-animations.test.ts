import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Lottie Animations (Gap 10)', () => {
  let app: Express;
  let db: DatabaseEngine;

  const ADMIN = 'admin@shaavir.com';
  const USER = 'user@shaavir.com';

  beforeEach(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    db = ctx.db;
    await seedMember(db, { email: ADMIN, name: 'Admin' });
    await seedMember(db, { email: USER, name: 'User' });
    await db.run('INSERT OR IGNORE INTO admins (email) VALUES (?)', [ADMIN]);
  });

  afterEach(async () => {
    await db.close();
  });

  const validLottie = JSON.stringify({ v: '5.7.4', fr: 30, ip: 0, op: 60, w: 100, h: 100, layers: [] });

  it('GET /api/settings/lottie returns 4 actions all disabled, no file_data', async () => {
    const res = await request(app).get('/api/settings/lottie');
    expect(res.status).toBe(200);
    expect(res.body.animations).toHaveLength(4);
    for (const a of res.body.animations) {
      expect(a.enabled).toBe(false);
      expect(a).not.toHaveProperty('file_data');
    }
  });

  it('PUT /api/settings/lottie/clock-in with valid Lottie JSON succeeds', async () => {
    const res = await request(app)
      .put('/api/settings/lottie/clock-in')
      .set('x-user-email', ADMIN)
      .send({ file_data: validLottie, file_name: 'test.json', file_size_bytes: validLottie.length, enabled: true });
    expect(res.status).toBe(200);
  });

  it('GET /api/settings/lottie/clock-in returns file_data after upload', async () => {
    await request(app)
      .put('/api/settings/lottie/clock-in')
      .set('x-user-email', ADMIN)
      .send({ file_data: validLottie, file_name: 'anim.json', file_size_bytes: validLottie.length });

    const res = await request(app).get('/api/settings/lottie/clock-in');
    expect(res.status).toBe(200);
    expect(res.body.file_data).toBe(validLottie);
    expect(res.body.file_name).toBe('anim.json');
  });

  it('PUT with file > 2 MB returns 400', async () => {
    const bigData = JSON.stringify({ data: 'x'.repeat(2 * 1024 * 1024) });
    const res = await request(app)
      .put('/api/settings/lottie/clock-in')
      .set('x-user-email', ADMIN)
      .send({ file_data: bigData });
    expect(res.status).toBe(400);
  });

  it('PUT with invalid JSON in file_data returns 400', async () => {
    const res = await request(app)
      .put('/api/settings/lottie/clock-in')
      .set('x-user-email', ADMIN)
      .send({ file_data: 'not json at all' });
    expect(res.status).toBe(400);
  });

  it('PUT with invalid action name returns 400', async () => {
    const res = await request(app)
      .put('/api/settings/lottie/invalid-action')
      .set('x-user-email', ADMIN)
      .send({ enabled: true });
    expect(res.status).toBe(400);
  });

  it('DELETE /api/settings/lottie/clock-in clears data and disables', async () => {
    // Upload first
    await request(app)
      .put('/api/settings/lottie/clock-in')
      .set('x-user-email', ADMIN)
      .send({ file_data: validLottie, enabled: true });

    // Delete
    const del = await request(app)
      .delete('/api/settings/lottie/clock-in')
      .set('x-user-email', ADMIN);
    expect(del.status).toBe(200);

    // Verify cleared
    const get = await request(app).get('/api/settings/lottie/clock-in');
    expect(get.body.file_data).toBeNull();
    expect(get.body.enabled).toBe(false);
  });

  it('PUT with enabled and duration_sec without file_data updates config only', async () => {
    const res = await request(app)
      .put('/api/settings/lottie/break')
      .set('x-user-email', ADMIN)
      .send({ enabled: true, duration_sec: 5 });
    expect(res.status).toBe(200);

    const get = await request(app).get('/api/settings/lottie/break');
    expect(get.body.enabled).toBe(true);
    expect(get.body.duration_sec).toBe(5);
  });

  it('non-admin PUT returns 403', async () => {
    const res = await request(app)
      .put('/api/settings/lottie/clock-in')
      .set('x-user-email', USER)
      .send({ enabled: true });
    expect(res.status).toBe(403);
  });

  it('duration validation rejects out of range (1-10)', async () => {
    const res = await request(app)
      .put('/api/settings/lottie/clock-in')
      .set('x-user-email', ADMIN)
      .send({ duration_sec: 15 });
    expect(res.status).toBe(400);
  });
});
