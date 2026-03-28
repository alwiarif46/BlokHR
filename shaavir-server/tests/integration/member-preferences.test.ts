import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Member Preferences (Gap 9)', () => {
  let app: Express;
  let db: DatabaseEngine;

  const USER_A = 'alice@shaavir.com';
  const USER_B = 'bob@shaavir.com';

  beforeEach(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    db = ctx.db;
    await seedMember(db, { email: USER_A, name: 'Alice' });
    await seedMember(db, { email: USER_B, name: 'Bob' });
  });

  afterEach(async () => {
    await db.close();
  });

  it('GET /api/profiles/me/prefs with no existing row returns defaults', async () => {
    const res = await request(app)
      .get('/api/profiles/me/prefs')
      .set('x-user-email', USER_A);
    expect(res.status).toBe(200);
    expect(res.body.theme).toBe('chromium');
    expect(res.body.bg_opacity).toBe(30);
    expect(res.body.dark_mode).toBe('system');
  });

  it('PUT /api/profiles/me/prefs with theme neural succeeds', async () => {
    const res = await request(app)
      .put('/api/profiles/me/prefs')
      .set('x-user-email', USER_A)
      .send({ theme: 'neural' });
    expect(res.status).toBe(200);

    const get = await request(app)
      .get('/api/profiles/me/prefs')
      .set('x-user-email', USER_A);
    expect(get.body.theme).toBe('neural');
  });

  it('PUT with partial update only changes specified field', async () => {
    // Set theme first
    await request(app)
      .put('/api/profiles/me/prefs')
      .set('x-user-email', USER_A)
      .send({ theme: 'holodeck' });

    // Update only accent color
    await request(app)
      .put('/api/profiles/me/prefs')
      .set('x-user-email', USER_A)
      .send({ color_accent: '#ff6b35' });

    const get = await request(app)
      .get('/api/profiles/me/prefs')
      .set('x-user-email', USER_A);
    expect(get.body.theme).toBe('holodeck');
    expect(get.body.color_accent).toBe('#ff6b35');
  });

  it('PUT with full update persists all fields', async () => {
    const res = await request(app)
      .put('/api/profiles/me/prefs')
      .set('x-user-email', USER_A)
      .send({
        theme: 'clean',
        dark_mode: 'dark',
        color_accent: '#aabbcc',
        bg_opacity: 50,
        bg_blur: 10,
        bg_darken: 80,
      });
    expect(res.status).toBe(200);
    expect(res.body.theme).toBe('clean');
    expect(res.body.bg_opacity).toBe(50);
  });

  it('two users have isolated preferences', async () => {
    await request(app)
      .put('/api/profiles/me/prefs')
      .set('x-user-email', USER_A)
      .send({ theme: 'neural' });

    const a = await request(app)
      .get('/api/profiles/me/prefs')
      .set('x-user-email', USER_A);
    const b = await request(app)
      .get('/api/profiles/me/prefs')
      .set('x-user-email', USER_B);

    expect(a.body.theme).toBe('neural');
    expect(b.body.theme).toBe('chromium');
  });

  it('invalid theme rejected with 400', async () => {
    const res = await request(app)
      .put('/api/profiles/me/prefs')
      .set('x-user-email', USER_A)
      .send({ theme: 'invalid_theme' });
    expect(res.status).toBe(400);
  });

  it('invalid hex color rejected with 400', async () => {
    const res = await request(app)
      .put('/api/profiles/me/prefs')
      .set('x-user-email', USER_A)
      .send({ color_accent: 'not-a-color' });
    expect(res.status).toBe(400);
  });

  it('bg_opacity out of range (0-100) rejected', async () => {
    const res = await request(app)
      .put('/api/profiles/me/prefs')
      .set('x-user-email', USER_A)
      .send({ bg_opacity: 150 });
    expect(res.status).toBe(400);
  });

  it('bg_blur out of range (0-30) rejected', async () => {
    const res = await request(app)
      .put('/api/profiles/me/prefs')
      .set('x-user-email', USER_A)
      .send({ bg_blur: 50 });
    expect(res.status).toBe(400);
  });

  it('bg_darken out of range (0-95) rejected', async () => {
    const res = await request(app)
      .put('/api/profiles/me/prefs')
      .set('x-user-email', USER_A)
      .send({ bg_darken: 100 });
    expect(res.status).toBe(400);
  });

  it('no identity header returns 401', async () => {
    const res = await request(app).get('/api/profiles/me/prefs');
    expect(res.status).toBe(401);
  });

  it('upsert idempotency — PUT same values twice', async () => {
    const data = { theme: 'neural', bg_opacity: 40 };
    const r1 = await request(app)
      .put('/api/profiles/me/prefs')
      .set('x-user-email', USER_A)
      .send(data);
    const r2 = await request(app)
      .put('/api/profiles/me/prefs')
      .set('x-user-email', USER_A)
      .send(data);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });

  it('timezone slots persist correctly', async () => {
    await request(app)
      .put('/api/profiles/me/prefs')
      .set('x-user-email', USER_A)
      .send({
        timezone_slot_1: 'America/New_York',
        timezone_slot_2: 'Europe/London',
        timezone_slot_3: 'Asia/Tokyo',
        timezone_slot_4: 'Australia/Sydney',
      });

    const get = await request(app)
      .get('/api/profiles/me/prefs')
      .set('x-user-email', USER_A);
    expect(get.body.timezone_slot_1).toBe('America/New_York');
    expect(get.body.timezone_slot_4).toBe('Australia/Sydney');
  });

  it('notification_prefs JSON string persists', async () => {
    const prefs = JSON.stringify({ email: true, push: false, sms: true });
    await request(app)
      .put('/api/profiles/me/prefs')
      .set('x-user-email', USER_A)
      .send({ notification_prefs: prefs });

    const get = await request(app)
      .get('/api/profiles/me/prefs')
      .set('x-user-email', USER_A);
    expect(get.body.notification_prefs).toBe(prefs);
  });

  it('existing profile routes unaffected (regression)', async () => {
    const res = await request(app)
      .get('/api/profiles/me')
      .set('x-user-email', USER_A);
    // Should still work — either 200 or other non-500
    expect(res.status).toBeLessThan(500);
  });
});
