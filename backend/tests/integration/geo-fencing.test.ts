import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Geo-Fencing Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  const EMAIL = 'alice@shaavir.com';
  // Delhi office coords
  const OFFICE_LAT = 28.6139;
  const OFFICE_LNG = 77.2090;
  // ~500m away from office
  const NEARBY_LAT = 28.6180;
  const NEARBY_LNG = 77.2090;
  // ~50km away
  const FAR_LAT = 29.0;
  const FAR_LNG = 77.2;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;

    await seedMember(db, {
      email: EMAIL,
      name: 'Alice',
      groupId: 'engineering',
      groupName: 'Engineering',
      groupShiftStart: '00:00',
      groupShiftEnd: '23:59',
    });
  });

  afterEach(async () => {
    await db.close();
  });

  /** Enable geo-fencing + create default office zone. */
  async function setupGeo(strict = true): Promise<number> {
    await request(app)
      .put('/api/geo/settings')
      .send({ enabled: true, strict });

    const res = await request(app)
      .post('/api/geo/zones')
      .send({ name: 'Delhi Office', latitude: OFFICE_LAT, longitude: OFFICE_LNG, radiusMeters: 200 });
    return res.body.id;
  }

  // ── Zone CRUD ──

  describe('Zone management', () => {
    it('creates a geo zone', async () => {
      const res = await request(app)
        .post('/api/geo/zones')
        .send({ name: 'HQ', latitude: OFFICE_LAT, longitude: OFFICE_LNG, radiusMeters: 300, address: 'Connaught Place' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('HQ');
      expect(res.body.latitude).toBe(OFFICE_LAT);
      expect(res.body.radius_meters).toBe(300);
      expect(res.body.address).toBe('Connaught Place');
    });

    it('lists active zones', async () => {
      await request(app)
        .post('/api/geo/zones')
        .send({ name: 'Zone A', latitude: 28.0, longitude: 77.0, radiusMeters: 100 });
      await request(app)
        .post('/api/geo/zones')
        .send({ name: 'Zone B', latitude: 29.0, longitude: 78.0, radiusMeters: 150 });

      const res = await request(app).get('/api/geo/zones');
      expect(res.status).toBe(200);
      expect(res.body.zones).toHaveLength(2);
    });

    it('updates a zone', async () => {
      const create = await request(app)
        .post('/api/geo/zones')
        .send({ name: 'Old Name', latitude: 28.0, longitude: 77.0, radiusMeters: 100 });

      await request(app)
        .put(`/api/geo/zones/${create.body.id}`)
        .send({ name: 'New Name', radiusMeters: 500 });

      const list = await request(app).get('/api/geo/zones');
      const updated = list.body.zones.find((z: Record<string, unknown>) => z.id === create.body.id);
      expect(updated.name).toBe('New Name');
      expect(updated.radius_meters).toBe(500);
    });

    it('deletes a zone', async () => {
      const create = await request(app)
        .post('/api/geo/zones')
        .send({ name: 'Temp', latitude: 28.0, longitude: 77.0, radiusMeters: 100 });

      const del = await request(app).delete(`/api/geo/zones/${create.body.id}`);
      expect(del.status).toBe(200);

      const list = await request(app).get('/api/geo/zones');
      expect(list.body.zones).toHaveLength(0);
    });

    it('rejects zone with missing name', async () => {
      const res = await request(app)
        .post('/api/geo/zones')
        .send({ latitude: 28.0, longitude: 77.0 });
      expect(res.status).toBe(400);
    });

    it('rejects zone with missing coordinates', async () => {
      const res = await request(app)
        .post('/api/geo/zones')
        .send({ name: 'Test' });
      expect(res.status).toBe(400);
    });
  });

  // ── Settings ──

  describe('Settings', () => {
    it('returns default settings (disabled)', async () => {
      const res = await request(app).get('/api/geo/settings');
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
      expect(res.body.strict).toBe(false);
    });

    it('updates settings', async () => {
      await request(app)
        .put('/api/geo/settings')
        .send({ enabled: true, strict: true });

      const res = await request(app).get('/api/geo/settings');
      expect(res.body.enabled).toBe(true);
      expect(res.body.strict).toBe(true);
    });
  });

  // ── Geo Clock ──

  describe('POST /api/clock/geo', () => {
    it('rejects when geo-fencing is disabled', async () => {
      const res = await request(app)
        .post('/api/clock/geo')
        .send({ email: EMAIL, action: 'in', latitude: OFFICE_LAT, longitude: OFFICE_LNG });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not enabled');
    });

    it('allows clock-in inside a zone (strict mode)', async () => {
      await setupGeo(true);

      const res = await request(app)
        .post('/api/clock/geo')
        .send({ email: EMAIL, name: 'Alice', action: 'in', latitude: OFFICE_LAT, longitude: OFFICE_LNG });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.insideZone).toBe(true);
      expect(res.body.matchedZone.name).toBe('Delhi Office');
      expect(res.body.clockResult.success).toBe(true);
    });

    it('rejects clock-in outside all zones (strict mode)', async () => {
      await setupGeo(true);

      const res = await request(app)
        .post('/api/clock/geo')
        .send({ email: EMAIL, action: 'in', latitude: FAR_LAT, longitude: FAR_LNG });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.insideZone).toBe(false);
      expect(res.body.error).toContain('Outside all zones');
      expect(res.body.nearestZone).toBeDefined();
      expect(res.body.nearestZone.name).toBe('Delhi Office');
    });

    it('allows clock-in outside zones in non-strict mode', async () => {
      await setupGeo(false);

      const res = await request(app)
        .post('/api/clock/geo')
        .send({ email: EMAIL, name: 'Alice', action: 'in', latitude: FAR_LAT, longitude: FAR_LNG });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.insideZone).toBe(false);
      expect(res.body.nearestZone).toBeDefined();
    });

    it('matches zone within radius (nearby but inside)', async () => {
      // Create a large zone (1km radius) — NEARBY_LAT is ~450m away
      await request(app)
        .put('/api/geo/settings')
        .send({ enabled: true, strict: true });
      await request(app)
        .post('/api/geo/zones')
        .send({ name: 'Large Zone', latitude: OFFICE_LAT, longitude: OFFICE_LNG, radiusMeters: 1000 });

      const res = await request(app)
        .post('/api/clock/geo')
        .send({ email: EMAIL, name: 'Alice', action: 'in', latitude: NEARBY_LAT, longitude: NEARBY_LNG });

      expect(res.body.success).toBe(true);
      expect(res.body.insideZone).toBe(true);
      expect(res.body.matchedZone.distanceMeters).toBeGreaterThan(0);
      expect(res.body.matchedZone.distanceMeters).toBeLessThan(1000);
    });

    it('logs geo clock attempts', async () => {
      await setupGeo(true);

      await request(app)
        .post('/api/clock/geo')
        .send({ email: EMAIL, name: 'Alice', action: 'in', latitude: OFFICE_LAT, longitude: OFFICE_LNG });

      const logs = await request(app).get(`/api/geo/logs?email=${EMAIL}`);
      expect(logs.body.logs).toHaveLength(1);
      expect(logs.body.logs[0].email).toBe(EMAIL);
      expect(logs.body.logs[0].inside_zone).toBe(1);
      expect(logs.body.logs[0].allowed).toBe(1);
    });

    it('logs rejected attempts in strict mode', async () => {
      await setupGeo(true);

      await request(app)
        .post('/api/clock/geo')
        .send({ email: EMAIL, action: 'in', latitude: FAR_LAT, longitude: FAR_LNG });

      const logs = await request(app).get(`/api/geo/logs?email=${EMAIL}`);
      expect(logs.body.logs).toHaveLength(1);
      expect(logs.body.logs[0].inside_zone).toBe(0);
      expect(logs.body.logs[0].allowed).toBe(0);
      expect(logs.body.logs[0].denial_reason).toContain('Outside all zones');
    });

    it('rejects missing coordinates', async () => {
      const res = await request(app)
        .post('/api/clock/geo')
        .send({ email: EMAIL, action: 'in' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('latitude');
    });

    it('rejects invalid latitude range', async () => {
      const res = await request(app)
        .post('/api/clock/geo')
        .send({ email: EMAIL, action: 'in', latitude: 91, longitude: 77 });
      expect(res.status).toBe(400);
    });

    it('rejects invalid longitude range', async () => {
      const res = await request(app)
        .post('/api/clock/geo')
        .send({ email: EMAIL, action: 'in', latitude: 28, longitude: 181 });
      expect(res.status).toBe(400);
    });

    it('rejects missing email', async () => {
      const res = await request(app)
        .post('/api/clock/geo')
        .send({ action: 'in', latitude: 28, longitude: 77 });
      expect(res.status).toBe(400);
    });

    it('rejects missing action', async () => {
      const res = await request(app)
        .post('/api/clock/geo')
        .send({ email: EMAIL, latitude: 28, longitude: 77 });
      expect(res.status).toBe(400);
    });

    it('includes accuracy in the log when provided', async () => {
      await setupGeo(false);

      await request(app)
        .post('/api/clock/geo')
        .send({ email: EMAIL, name: 'Alice', action: 'in', latitude: OFFICE_LAT, longitude: OFFICE_LNG, accuracyMeters: 15.5 });

      const logs = await request(app).get(`/api/geo/logs?email=${EMAIL}`);
      expect(logs.body.logs[0].accuracy_meters).toBe(15.5);
    });
  });
});
