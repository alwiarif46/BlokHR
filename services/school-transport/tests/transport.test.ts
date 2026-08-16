import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolTransportApp,
  type SchoolTransportSqlite,
} from '../src/index';

describe('school-transport fleet (P7-01)', () => {
  let app: Express;
  let db: SchoolTransportSqlite;
  let clock: { now: Date };

  beforeEach(async () => {
    clock = { now: new Date('2025-09-15T12:00:00.000Z') };
    const created = await createSchoolTransportApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      clock: () => clock.now,
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  async function seedVehicle(capacity = 2) {
    const res = await request(app).post('/api/transport/t1/vehicles').set(staff('school_admin')).send({
      registration: 'KA01AB1234',
      capacity,
      insurance_expiry: '2025-10-01',
      fitness_expiry: '2026-01-01',
    });
    expect(res.status).toBe(201);
    return res.body as { id: string };
  }

  it('health ok', async () => {
    const res = await request(app).get('/health').set(staff('school_admin'));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('vehicle/route/stop CRUD + resequence', async () => {
    const vehicle = await seedVehicle();
    const route = await request(app).post('/api/transport/t1/routes').set(staff('school_admin')).send({
      label: 'North',
      vehicle_id: vehicle.id,
      attendant_name: 'Ravi',
    });
    expect(route.status).toBe(201);

    const s1 = await request(app)
      .post(`/api/transport/t1/routes/${route.body.id}/stops`).set(staff('school_admin'))
      .send({
        label: 'Stop A',
        lat: 12.97,
        lng: 77.59,
        pickup_time: '07:30',
        drop_time: '14:00',
      });
    const s2 = await request(app)
      .post(`/api/transport/t1/routes/${route.body.id}/stops`).set(staff('school_admin'))
      .send({
        label: 'Stop B',
        lat: 12.98,
        lng: 77.6,
        pickup_time: '07:45',
        drop_time: '13:45',
      });
    expect(s1.body.sequence).toBe(1);
    expect(s2.body.sequence).toBe(2);

    const reseq = await request(app)
      .post(`/api/transport/t1/routes/${route.body.id}/stops/resequence`).set(staff('school_admin'))
      .send({ stop_ids: [s2.body.id, s1.body.id] });
    expect(reseq.status).toBe(200);
    expect(reseq.body.stops.map((s: { id: string }) => s.id)).toEqual([
      s2.body.id,
      s1.body.id,
    ]);
    expect(reseq.body.stops[0].sequence).toBe(1);
  });

  it('capacity guard on assign', async () => {
    const vehicle = await seedVehicle(1);
    const route = await request(app).post('/api/transport/t1/routes').set(staff('school_admin')).send({
      label: 'East',
      vehicle_id: vehicle.id,
    });
    const stop = await request(app)
      .post(`/api/transport/t1/routes/${route.body.id}/stops`).set(staff('school_admin'))
      .send({
        label: 'Gate',
        lat: 12.9,
        lng: 77.5,
        pickup_time: '07:00',
        drop_time: '14:00',
      });

    const a1 = await request(app)
      .post(`/api/transport/t1/routes/${route.body.id}/students`).set(staff('school_admin'))
      .send({ stop_id: stop.body.id, student_ref: 'stu-1' });
    expect(a1.status).toBe(201);

    const a2 = await request(app)
      .post(`/api/transport/t1/routes/${route.body.id}/students`).set(staff('school_admin'))
      .send({ stop_id: stop.body.id, student_ref: 'stu-2' });
    expect(a2.status).toBe(409);

    const un = await request(app).delete(
      `/api/transport/t1/routes/${route.body.id}/students/stu-1`,
    ).set(staff('school_admin'));
    expect(un.status).toBe(200);
  });

  it('expiry window report', async () => {
    await seedVehicle();
    const within = await request(app).get(
      '/api/transport/t1/expiries?within_days=30',
    ).set(staff('school_admin'));
    expect(within.status).toBe(200);
    expect(within.body.expiries.some((e: { kind: string }) => e.kind === 'insurance')).toBe(
      true,
    );
    expect(
      within.body.expiries.every((e: { kind: string }) => e.kind !== 'fitness'),
    ).toBe(true);

    const far = await request(app).get(
      '/api/transport/t1/expiries?within_days=200',
    ).set(staff('school_admin'));
    expect(far.body.expiries.length).toBeGreaterThanOrEqual(2);
  });

  it('tenant isolation', async () => {
    const vehicle = await seedVehicle();
    const other = await request(app).get(`/api/transport/t2/vehicles/${vehicle.id}`).set(staff('school_admin'));
    expect(other.status).toBe(404);
  });
});
