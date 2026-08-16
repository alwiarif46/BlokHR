import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff, internalOnly } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolTransportApp,
  haversineKm,
  computeEta,
  type DomainEvent,
  type EventPublisher,
  type SchoolTransportSqlite,
} from '../src/index';

describe('haversineKm + computeEta (table-driven)', () => {
  // 1° longitude at equator ≈ 111.195 km (WGS84 sphere R=6371)
  it('hand-computed equatorial degree', () => {
    const d = haversineKm(0, 0, 0, 1);
    expect(d).toBeCloseTo(111.195, 2);
  });

  it('same point is zero', () => {
    expect(haversineKm(12.97, 77.59, 12.97, 77.59)).toBe(0);
  });

  it('ETA uses max(avg, 15); stale when age > 10 min', () => {
    // 15 km at 30 km/h → 30 minutes
    const ok = computeEta({
      fromLat: 0,
      fromLng: 0,
      toLat: 0,
      toLng: 15 / 111.195,
      avgSpeedKmh: 30,
      pingAgeSeconds: 60,
    });
    expect(ok.stale).toBe(false);
    if (!ok.stale) {
      expect(ok.etaMinutes).toBeCloseTo(30, 0);
      expect(ok.speedKmh).toBe(30);
    }

    // avg 5 → floor to 15 km/h; 15 km → 60 minutes
    const slow = computeEta({
      fromLat: 0,
      fromLng: 0,
      toLat: 0,
      toLng: 15 / 111.195,
      avgSpeedKmh: 5,
      pingAgeSeconds: 0,
    });
    expect(slow.stale).toBe(false);
    if (!slow.stale) {
      expect(slow.etaMinutes).toBeCloseTo(60, 0);
      expect(slow.speedKmh).toBe(15);
    }

    const stale = computeEta({
      fromLat: 0,
      fromLng: 0,
      toLat: 1,
      toLng: 1,
      avgSpeedKmh: 40,
      pingAgeSeconds: 601,
    });
    expect(stale.stale).toBe(true);
    expect(stale.etaMinutes).toBeNull();
  });
});

describe('school-transport telemetry (P7-03)', () => {
  let app: Express;
  let db: SchoolTransportSqlite;
  let events: DomainEvent[];
  let clock: { now: Date };
  let vehicleId: string;
  let routeId: string;
  let stopId: string;

  beforeEach(async () => {
    events = [];
    clock = { now: new Date('2025-09-10T07:00:00.000Z') };
    const publisher: EventPublisher = {
      publish: async (e) => {
        events.push(e);
      },
    };
    const created = await createSchoolTransportApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      events: publisher,
      clock: () => clock.now,
    });
    app = created.app;
    db = created.db;

    const vehicle = await request(app).post('/api/transport/t1/vehicles').set(staff('school_admin')).send({
      registration: 'KA01GPS1',
      capacity: 40,
      insurance_expiry: '2026-01-01',
      fitness_expiry: '2026-06-01',
    });
    vehicleId = vehicle.body.id;
    const route = await request(app).post('/api/transport/t1/routes').set(staff('school_admin')).send({
      label: 'GPS Route',
      vehicle_id: vehicleId,
    });
    routeId = route.body.id;
    // ~15 km east of (0,0) at equator for ETA math
    const stop = await request(app)
      .post(`/api/transport/t1/routes/${routeId}/stops`).set(staff('school_admin'))
      .send({
        label: 'East Stop',
        lat: 0,
        lng: 15 / 111.195,
        pickup_time: '07:10',
        drop_time: '14:00',
      });
    stopId = stop.body.id;
  });

  afterEach(async () => {
    await db.close();
  });

  it('ping validation + batch cap', async () => {
    const bad = await request(app).post('/api/transport/t1/pings').set(internalOnly()).send([
      { vehicle_id: vehicleId, lat: 100, lng: 0, at: clock.now.toISOString() },
    ]);
    expect(bad.status).toBe(400);

    const tooBig = await request(app)
      .post('/api/transport/t1/pings')
      .set(internalOnly())
      .send(
        Array.from({ length: 501 }, () => ({
          vehicle_id: vehicleId,
          lat: 0,
          lng: 0,
          at: clock.now.toISOString(),
        })),
      );
    expect(tooBig.status).toBe(400);

    const ok = await request(app).post('/api/transport/t1/pings').set(internalOnly()).send([
      {
        vehicle_id: vehicleId,
        lat: 0,
        lng: 0,
        speed_kmh: 30,
        at: '2025-09-10T06:55:00.000Z',
      },
    ]);
    expect(ok.status).toBe(201);
    expect(ok.body.pings).toHaveLength(1);
  });

  it('prune + last-known staleness', async () => {
    await request(app).post('/api/transport/t1/pings').set(internalOnly()).send([
      {
        vehicle_id: vehicleId,
        lat: 1,
        lng: 1,
        at: '2025-07-01T00:00:00.000Z',
      },
      {
        vehicle_id: vehicleId,
        lat: 0,
        lng: 0,
        speed_kmh: 20,
        at: '2025-09-10T06:50:00.000Z',
      },
    ]);
    const pruned = await request(app).post('/api/transport/t1/pings/prune').set(staff('school_admin'));
    expect(pruned.body.deleted).toBe(1);

    clock.now = new Date('2025-09-10T07:00:00.000Z');
    const last = await request(app).get(
      `/api/transport/t1/vehicles/${vehicleId}/last-known`,
    ).set(staff('school_admin'));
    expect(last.status).toBe(200);
    expect(last.body.ping.lat).toBe(0);
    expect(last.body.staleSeconds).toBe(600);
  });

  it('ETA fresh vs stale; delay once-per-day; tenant isolation', async () => {
    await request(app).post('/api/transport/t1/pings').set(internalOnly()).send([
      {
        vehicle_id: vehicleId,
        lat: 0,
        lng: 0,
        speed_kmh: 30,
        at: '2025-09-10T06:55:00.000Z',
      },
    ]);
    const eta = await request(app).get(
      `/api/transport/t1/routes/${routeId}/eta?stop_id=${stopId}`,
    ).set(staff('school_admin'));
    expect(eta.status).toBe(200);
    expect(eta.body.stale).toBe(false);
    expect(eta.body.eta).toBeCloseTo(30, 0);

    clock.now = new Date('2025-09-10T07:10:00.000Z');
    const staleEta = await request(app).get(
      `/api/transport/t1/routes/${routeId}/eta?stop_id=${stopId}`,
    ).set(staff('school_admin'));
    expect(staleEta.body.stale).toBe(true);
    expect(staleEta.body.eta).toBeNull();

    // Fresh ping again; ETA 30 min from 07:00 → arrive 07:30; scheduled 07:10 +15 = 07:25 → delayed
    clock.now = new Date('2025-09-10T07:00:00.000Z');
    await request(app).post('/api/transport/t1/pings').set(internalOnly()).send([
      {
        vehicle_id: vehicleId,
        lat: 0,
        lng: 0,
        speed_kmh: 30,
        at: '2025-09-10T06:55:00.000Z',
      },
    ]);
    events.length = 0;
    const d1 = await request(app)
      .post(`/api/transport/t1/routes/${routeId}/check-delay`).set(staff('school_admin'))
      .send({ leg: 'pickup' });
    expect(d1.body.delayed).toBe(true);
    expect(d1.body.minutesLate).toBeGreaterThanOrEqual(15);
    expect(events.some((e) => e.type === 'school.transport.delayed')).toBe(true);

    const d2 = await request(app)
      .post(`/api/transport/t1/routes/${routeId}/check-delay`).set(staff('school_admin'))
      .send({ leg: 'pickup' });
    expect(d2.body.skipped).toBe(true);

    const other = await request(app).get(
      `/api/transport/t2/vehicles/${vehicleId}/last-known`,
    ).set(staff('school_admin'));
    expect(other.status).toBe(404);
  });
});
