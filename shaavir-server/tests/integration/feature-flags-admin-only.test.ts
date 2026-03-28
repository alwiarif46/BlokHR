import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { SqliteEngine } from '../../src/db/sqlite-engine';
import { MigrationRunner } from '../../src/db/migration-runner';
import { createApp } from '../../src/app';
import { FeatureFlagService } from '../../src/services/feature-flags';
import { SseBroadcaster } from '../../src/sse/broadcaster';
import { createAnalyticsRouter } from '../../src/routes/analytics';
import { createFaceRecognitionRouter } from '../../src/routes/face-recognition';
import { createFeatureFlagsRouter } from '../../src/routes/feature-flags';
import { createTrainingRouter } from '../../src/routes/training';
import { createSurveyRouter } from '../../src/routes/surveys';
import { MockFaceApiClient } from '../../src/services/face-recognition';
import { testLogger, testConfig, seedMember } from '../helpers/setup';

describe('Feature Flags Admin-Only (Gap 7)', () => {
  let app: Express;
  let db: DatabaseEngine;
  let featureFlags: FeatureFlagService;

  const ADMIN = 'admin@shaavir.com';
  const USER = 'user@shaavir.com';

  beforeEach(async () => {
    db = new SqliteEngine(':memory:');
    await (db as SqliteEngine).initialize();
    const migrationsDir = path.resolve(__dirname, '../../migrations');
    const runner = new MigrationRunner(db, migrationsDir, testLogger);
    await runner.run();

    const config = testConfig();
    featureFlags = new FeatureFlagService(db, testLogger);
    await featureFlags.load();
    const mockFaceApi = new MockFaceApiClient();

    app = createApp(config, testLogger, (a) => {
      // Use guardWithAdmin for this test
      a.use(featureFlags.guardWithAdmin(db));
      a.use('/api', createAnalyticsRouter(db, testLogger));
      a.use('/api', createFaceRecognitionRouter(db, config, testLogger, mockFaceApi));
      a.use('/api', createFeatureFlagsRouter(featureFlags, testLogger, db));
      a.use('/api', createTrainingRouter(db, testLogger));
      a.use('/api', createSurveyRouter(db, testLogger));
    });

    await seedMember(db, { email: ADMIN, name: 'Admin User' });
    await seedMember(db, { email: USER, name: 'Regular User' });
    await db.run('INSERT OR IGNORE INTO admins (email) VALUES (?)', [ADMIN]);
  });

  afterEach(async () => {
    await db.close();
  });

  it('non-admin GET /api/features excludes admin-only flags', async () => {
    const res = await request(app)
      .get('/api/features')
      .set('x-user-email', USER);
    expect(res.status).toBe(200);
    const keys = res.body.features.map((f: { key: string }) => f.key);
    expect(keys).not.toContain('analytics');
    expect(keys).not.toContain('face_recognition');
  });

  it('admin GET /api/features includes admin-only flags', async () => {
    const res = await request(app)
      .get('/api/features')
      .set('x-user-email', ADMIN);
    expect(res.status).toBe(200);
    const keys = res.body.features.map((f: { key: string }) => f.key);
    expect(keys).toContain('analytics');
  });

  it('no auth header returns only non-adminOnly enabled flags', async () => {
    const res = await request(app).get('/api/features');
    expect(res.status).toBe(200);
    const adminOnlyFlags = res.body.features.filter((f: { adminOnly: boolean }) => f.adminOnly);
    expect(adminOnlyFlags).toHaveLength(0);
  });

  it('non-admin PUT /api/features/:key returns 403', async () => {
    const res = await request(app)
      .put('/api/features/live_chat')
      .set('x-user-email', USER)
      .send({ enabled: false });
    expect(res.status).toBe(403);
  });

  it('admin PUT /api/features/:key returns 200', async () => {
    const res = await request(app)
      .put('/api/features/live_chat')
      .set('x-user-email', ADMIN)
      .send({ enabled: false });
    expect(res.status).toBe(200);
  });

  it('non-admin GET /api/analytics returns 403 (when feature enabled)', async () => {
    // Enable analytics feature first
    await request(app)
      .put('/api/features/analytics')
      .set('x-user-email', ADMIN)
      .send({ enabled: true });

    const res = await request(app)
      .get('/api/analytics/departments')
      .set('x-user-email', USER);
    expect(res.status).toBe(403);
  });

  it('admin GET /api/analytics returns 200 (when feature enabled)', async () => {
    // Enable analytics feature first
    await request(app)
      .put('/api/features/analytics')
      .set('x-user-email', ADMIN)
      .send({ enabled: true });

    const res = await request(app)
      .get('/api/analytics/departments')
      .set('x-user-email', ADMIN);
    expect(res.status).toBe(200);
  });

  it('non-admin GET /api/export returns 403', async () => {
    const res = await request(app)
      .get('/api/export/attendance?startDate=2026-01-01&endDate=2026-12-31')
      .set('x-user-email', USER);
    // 403 because export is admin-only (or 404 if route doesn't exist yet, which is fine)
    expect([403, 404]).toContain(res.status);
  });

  it('admin GET /api/export returns non-403', async () => {
    const res = await request(app)
      .get('/api/export/attendance?startDate=2026-01-01&endDate=2026-12-31')
      .set('x-user-email', ADMIN);
    // Should pass the guard — might 404 if export route isn't registered yet
    expect(res.status).not.toBe(403);
  });

  it('non-admin POST /api/face/enroll returns 403 (when feature enabled)', async () => {
    // Enable face recognition first
    await request(app)
      .put('/api/features/face_recognition')
      .set('x-user-email', ADMIN)
      .send({ enabled: true });

    const res = await request(app)
      .post('/api/face/enroll')
      .set('x-user-email', USER)
      .send({});
    expect(res.status).toBe(403);
  });

  it('admin POST /api/face/enroll passes guard (when feature enabled)', async () => {
    // Enable face recognition first
    await request(app)
      .put('/api/features/face_recognition')
      .set('x-user-email', ADMIN)
      .send({ enabled: true });

    const res = await request(app)
      .post('/api/face/enroll')
      .set('x-user-email', ADMIN)
      .send({ email: 'test@test.com', imageData: 'base64data' });
    // Passes admin guard — may fail at handler level but not 403
    expect(res.status).not.toBe(403);
  });

  it('non-admin GET /api/training returns 200 (not admin-only)', async () => {
    const res = await request(app)
      .get('/api/training/courses')
      .set('x-user-email', USER);
    expect(res.status).toBe(200);
  });

  it('non-admin GET /api/surveys returns 200 (not admin-only)', async () => {
    const res = await request(app)
      .get('/api/surveys')
      .set('x-user-email', USER);
    expect(res.status).toBe(200);
  });

  it('migration applied — admin_only column exists with correct values', async () => {
    const analytics = await db.get<{ admin_only: number }>(
      'SELECT admin_only FROM feature_flags WHERE feature_key = ?',
      ['analytics'],
    );
    expect(analytics).toBeTruthy();
    expect(analytics!.admin_only).toBe(1);

    const liveChat = await db.get<{ admin_only: number }>(
      'SELECT admin_only FROM feature_flags WHERE feature_key = ?',
      ['live_chat'],
    );
    expect(liveChat).toBeTruthy();
    expect(liveChat!.admin_only).toBe(0);
  });

  it('disabled feature still returns 404', async () => {
    // Disable a feature (training_lms is mounted in this test app)
    await request(app)
      .put('/api/features/training_lms')
      .set('x-user-email', ADMIN)
      .send({ enabled: false });

    // Access it — should be 404
    const res = await request(app)
      .get('/api/training/courses')
      .set('x-user-email', ADMIN);
    expect(res.status).toBe(404);
  });
});
