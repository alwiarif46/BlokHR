import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';
import type { FeatureFlagService } from '../../src/services/feature-flags';

describe('Feature Flags Module', () => {
  let app: Express;
  let db: DatabaseEngine;
  let featureFlags: FeatureFlagService;

  const EMAIL = 'alice@shaavir.com';
  const ADMIN = 'admin@shaavir.com';

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    featureFlags = setup.featureFlags;

    await seedMember(db, {
      email: EMAIL,
      name: 'Alice',
      groupId: 'engineering',
      groupName: 'Engineering',
      groupShiftStart: '09:00',
      groupShiftEnd: '18:00',
    });
    await db.run('INSERT OR IGNORE INTO admins (email) VALUES (?)', [ADMIN]);
  });

  afterEach(async () => {
    await db.close();
  });

  // ── List features ──

  describe('GET /api/features', () => {
    it('lists all features with all=true', async () => {
      const res = await request(app).get('/api/features?all=true');
      expect(res.status).toBe(200);
      expect(res.body.features.length).toBeGreaterThanOrEqual(18);

      const keys = res.body.features.map((f: { key: string }) => f.key);
      expect(keys).toContain('face_recognition');
      expect(keys).toContain('geo_fencing');
      expect(keys).toContain('ai_chatbot');
      expect(keys).toContain('analytics');
    });

    it('lists only enabled features by default', async () => {
      // Disable one feature
      await featureFlags.toggle('analytics', false, ADMIN);

      const res = await request(app).get('/api/features');
      const keys = res.body.features.map((f: { key: string }) => f.key);
      expect(keys).not.toContain('analytics');
    });

    it('shows all features including disabled when all=true', async () => {
      await featureFlags.toggle('analytics', false, ADMIN);

      const res = await request(app).get('/api/features?all=true');
      const analytics = res.body.features.find((f: { key: string }) => f.key === 'analytics');
      expect(analytics).toBeTruthy();
      expect(analytics.enabled).toBe(false);
    });
  });

  describe('GET /api/features/enabled', () => {
    it('returns compact enabled feature list', async () => {
      const res = await request(app).get('/api/features/enabled');
      expect(res.status).toBe(200);
      expect(res.body.features[0]).toHaveProperty('key');
      expect(res.body.features[0]).toHaveProperty('label');
      expect(res.body.features[0]).toHaveProperty('category');
      expect(res.body.features[0]).not.toHaveProperty('description');
    });
  });

  // ── Toggle ──

  describe('PUT /api/features/:key', () => {
    it('disables a feature', async () => {
      const res = await request(app)
        .put('/api/features/geo_fencing')
        .send({ enabled: false, email: ADMIN });

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);

      expect(featureFlags.isEnabled('geo_fencing')).toBe(false);
    });

    it('re-enables a feature', async () => {
      await featureFlags.toggle('geo_fencing', false, ADMIN);

      const res = await request(app)
        .put('/api/features/geo_fencing')
        .send({ enabled: true, email: ADMIN });

      expect(res.status).toBe(200);
      expect(featureFlags.isEnabled('geo_fencing')).toBe(true);
    });

    it('rejects unknown feature key', async () => {
      const res = await request(app)
        .put('/api/features/nonexistent')
        .send({ enabled: false, email: ADMIN });

      expect(res.status).toBe(400);
    });

    it('rejects missing enabled boolean', async () => {
      const res = await request(app)
        .put('/api/features/geo_fencing')
        .send({ email: ADMIN });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/features (bulk)', () => {
    it('bulk updates multiple features', async () => {
      const res = await request(app)
        .put('/api/features')
        .send({
          email: ADMIN,
          updates: [
            { key: 'geo_fencing', enabled: false },
            { key: 'analytics', enabled: false },
            { key: 'live_chat', enabled: false },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(3);
      expect(featureFlags.isEnabled('geo_fencing')).toBe(false);
      expect(featureFlags.isEnabled('analytics')).toBe(false);
      expect(featureFlags.isEnabled('live_chat')).toBe(false);
    });
  });

  // ── Guard middleware — disabled features return 404 ──

  describe('Feature guard (404 when disabled)', () => {
    it('geo-fencing routes return 404 when disabled', async () => {
      await featureFlags.toggle('geo_fencing', false, ADMIN);

      const res = await request(app).get('/api/geo/zones');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });

    it('analytics routes return 404 when disabled', async () => {
      await featureFlags.toggle('analytics', false, ADMIN);

      const res = await request(app).get('/api/analytics/attendance');
      expect(res.status).toBe(404);
    });

    it('live chat routes return 404 when disabled', async () => {
      await featureFlags.toggle('live_chat', false, ADMIN);

      const res = await request(app).get('/api/channels');
      expect(res.status).toBe(404);

      const dmRes = await request(app).get('/api/dm/contacts?email=alice@shaavir.com');
      expect(dmRes.status).toBe(404);
    });

    it('chatbot routes return 404 when disabled', async () => {
      await featureFlags.toggle('ai_chatbot', false, ADMIN);

      const res = await request(app).get('/api/chat/tools');
      expect(res.status).toBe(404);
    });

    it('overtime routes return 404 when disabled', async () => {
      await featureFlags.toggle('overtime', false, ADMIN);

      const res = await request(app).get('/api/overtime/pending');
      expect(res.status).toBe(404);
    });

    it('time tracking routes return 404 when disabled', async () => {
      await featureFlags.toggle('time_tracking', false, ADMIN);

      const res = await request(app).get('/api/time-tracking/clients');
      expect(res.status).toBe(404);
    });

    it('file storage routes return 404 when disabled', async () => {
      await featureFlags.toggle('file_storage', false, ADMIN);

      const res = await request(app).get('/api/storage/config');
      expect(res.status).toBe(404);
    });

    it('re-enabling restores access', async () => {
      await featureFlags.toggle('analytics', false, ADMIN);

      // Disabled — 404
      let res = await request(app).get('/api/analytics/attendance?startDate=2026-03-01&endDate=2026-03-31');
      expect(res.status).toBe(404);

      // Re-enable
      await featureFlags.toggle('analytics', true, ADMIN);

      // Enabled — 200
      res = await request(app).get('/api/analytics/attendance?startDate=2026-03-01&endDate=2026-03-31');
      expect(res.status).toBe(200);
    });

    it('core routes (clock, leaves) are never blocked', async () => {
      // Even if someone somehow tried to disable core features,
      // they aren't in the FEATURE_ROUTE_MAP, so the guard ignores them.
      const clock = await request(app)
        .post('/api/clock')
        .send({ action: 'in', email: EMAIL, name: 'Alice' });
      expect(clock.status).toBe(200);
    });
  });

  // ── isEnabled() cache ──

  describe('isEnabled() cache behavior', () => {
    it('returns true for unknown feature keys (fail-open)', () => {
      expect(featureFlags.isEnabled('nonexistent_feature')).toBe(true);
    });

    it('cache updates immediately after toggle', async () => {
      expect(featureFlags.isEnabled('geo_fencing')).toBe(true);

      await featureFlags.toggle('geo_fencing', false, ADMIN);
      expect(featureFlags.isEnabled('geo_fencing')).toBe(false);

      await featureFlags.toggle('geo_fencing', true, ADMIN);
      expect(featureFlags.isEnabled('geo_fencing')).toBe(true);
    });
  });

  // ── Data preservation ──

  describe('Data preserved when feature disabled', () => {
    it('geo zone data survives toggle off and on', async () => {
      // Create a zone while enabled
      await request(app)
        .post('/api/geo/zones')
        .send({ name: 'Office', latitude: 28.6, longitude: 77.2, radiusMeters: 100 });

      // Disable geo
      await featureFlags.toggle('geo_fencing', false, ADMIN);

      // Routes are 404
      const blocked = await request(app).get('/api/geo/zones');
      expect(blocked.status).toBe(404);

      // Re-enable
      await featureFlags.toggle('geo_fencing', true, ADMIN);

      // Data is still there
      const res = await request(app).get('/api/geo/zones');
      expect(res.status).toBe(200);
      expect(res.body.zones).toHaveLength(1);
      expect(res.body.zones[0].name).toBe('Office');
    });
  });
});
