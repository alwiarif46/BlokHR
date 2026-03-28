import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { SqliteEngine } from '../../src/db/sqlite-engine';
import { MigrationRunner } from '../../src/db/migration-runner';
import { createApp } from '../../src/app';
import { createGeoRouter } from '../../src/routes/geo';
import { createClockRouter } from '../../src/routes/clock';
import { testLogger, testConfig, seedMember } from '../helpers/setup';

describe('Geo Routes Registration (Gap 2)', () => {
  let app: Express;
  let db: DatabaseEngine;

  const EMAIL = 'geo@shaavir.com';

  beforeEach(async () => {
    db = new SqliteEngine(':memory:');
    await (db as SqliteEngine).initialize();
    const migrationsDir = path.resolve(__dirname, '../../migrations');
    const runner = new MigrationRunner(db, migrationsDir, testLogger);
    await runner.run();

    const config = testConfig();
    app = createApp(config, testLogger, (a) => {
      a.use('/api', createClockRouter(db, testLogger));
      a.use('/api', createGeoRouter(db, testLogger));
    });

    await seedMember(db, {
      email: EMAIL,
      name: 'Geo User',
      groupShiftStart: '00:00',
      groupShiftEnd: '23:59',
    });
  });

  afterEach(async () => {
    await db.close();
  });

  it('GET /api/geo/zones returns 200 with zones array', async () => {
    const res = await request(app).get('/api/geo/zones');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('zones');
    expect(Array.isArray(res.body.zones)).toBe(true);
  });

  it('POST /api/geo/zones with valid body returns 201', async () => {
    const res = await request(app)
      .post('/api/geo/zones')
      .send({ name: 'Test Office', latitude: 28.6139, longitude: 77.209, radiusMeters: 200 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('PUT /api/geo/zones/:id returns 200', async () => {
    const createRes = await request(app)
      .post('/api/geo/zones')
      .send({ name: 'Office', latitude: 28.6139, longitude: 77.209, radiusMeters: 200 });
    const zoneId = createRes.body.id;

    const res = await request(app)
      .put(`/api/geo/zones/${zoneId}`)
      .send({ name: 'Updated Office', radiusMeters: 500 });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/geo/zones/:id returns 200', async () => {
    const createRes = await request(app)
      .post('/api/geo/zones')
      .send({ name: 'Temp', latitude: 28.6, longitude: 77.2, radiusMeters: 100 });
    const zoneId = createRes.body.id;

    const res = await request(app).delete(`/api/geo/zones/${zoneId}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/geo/settings returns 200', async () => {
    const res = await request(app).get('/api/geo/settings');
    expect(res.status).toBe(200);
  });

  it('PUT /api/geo/settings with enabled returns 200', async () => {
    const res = await request(app)
      .put('/api/geo/settings')
      .send({ enabled: true, strict: false });
    expect(res.status).toBe(200);
  });

  it('GET /api/geo/logs returns 200', async () => {
    const res = await request(app).get('/api/geo/logs');
    expect(res.status).toBe(200);
  });

  it('POST /api/clock/geo when disabled succeeds', async () => {
    const res = await request(app)
      .post('/api/clock/geo')
      .send({ email: EMAIL, action: 'in', latitude: 28.6139, longitude: 77.209 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
