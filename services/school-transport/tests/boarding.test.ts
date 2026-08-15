import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolTransportApp,
  hashCapturePayloadB64,
  type DomainEvent,
  type EventPublisher,
  type SchoolTransportSqlite,
} from '../src/index';

describe('school-transport boarding (P7-02)', () => {
  let app: Express;
  let db: SchoolTransportSqlite;
  let events: DomainEvent[];

  const cardB64 = Buffer.from('card-token-xyz', 'utf8').toString('base64');

  async function seedRoute() {
    const vehicle = await request(app).post('/api/transport/t1/vehicles').send({
      registration: 'KA01XY9999',
      capacity: 40,
      insurance_expiry: '2026-01-01',
      fitness_expiry: '2026-06-01',
    });
    const route = await request(app).post('/api/transport/t1/routes').send({
      label: 'North Loop',
      vehicle_id: vehicle.body.id,
    });
    const stop = await request(app)
      .post(`/api/transport/t1/routes/${route.body.id}/stops`)
      .send({
        label: 'Park Gate',
        lat: 12.97,
        lng: 77.59,
        pickup_time: '07:30',
        drop_time: '14:00',
      });
    await request(app)
      .post(`/api/transport/t1/routes/${route.body.id}/students`)
      .send({ stop_id: stop.body.id, student_ref: 'stu-1' });
    await request(app)
      .post(`/api/transport/t1/routes/${route.body.id}/students`)
      .send({ stop_id: stop.body.id, student_ref: 'stu-2' });
    return { routeId: route.body.id as string, stopId: stop.body.id as string };
  }

  beforeEach(async () => {
    events = [];
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
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('bind+capture; events; raw payload never stored', async () => {
    const { routeId } = await seedRoute();
    const bind = await request(app).post('/api/transport/t1/bindings').send({
      student_ref: 'stu-1',
      payload_b64: cardB64,
    });
    expect(bind.status).toBe(201);
    expect(bind.body.payloadHash).toBe(hashCapturePayloadB64(cardB64));
    expect(JSON.stringify(bind.body)).not.toContain(cardB64);
    expect(JSON.stringify(bind.body)).not.toContain('card-token-xyz');

    const board = await request(app).post('/api/transport/t1/boarding').send({
      payload_b64: cardB64,
      direction: 'board',
      leg: 'pickup',
      route_id: routeId,
      at: '2025-09-10T07:31:00.000Z',
      device_id: 'bus-rfid-1',
      idempotency_key: 'k1',
    });
    expect(board.status).toBe(200);
    expect(board.body.unmatched).toBe(false);
    expect(board.body.event.studentRef).toBe('stu-1');
    expect(events.some((e) => e.type === 'school.transport.boarded')).toBe(true);
    expect(events[0]!.data.stop_hint).toBe('Park Gate');

    const row = await db.get<{ payload_hash: string }>(
      'SELECT payload_hash FROM transport_bindings WHERE tenant_id = ?',
      ['t1'],
    );
    expect(row?.payload_hash).toBe(hashCapturePayloadB64(cardB64));
    const rawScan = await db.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM transport_bindings
       WHERE payload_hash LIKE '%card-token%' OR payload_hash LIKE '%${cardB64}%'`,
    );
    expect(Number(rawScan?.c)).toBe(0);
  });

  it('unmatched capture returns 200; anomaly on alight without board', async () => {
    const { routeId } = await seedRoute();
    const unknown = await request(app).post('/api/transport/t1/boarding').send({
      payload_b64: Buffer.from('unknown-card').toString('base64'),
      direction: 'board',
      leg: 'pickup',
      route_id: routeId,
      at: '2025-09-10T07:30:00.000Z',
    });
    expect(unknown.status).toBe(200);
    expect(unknown.body.unmatched).toBe(true);
    expect(events.filter((e) => e.type === 'school.transport.boarded')).toHaveLength(0);

    events.length = 0;
    const alight = await request(app).post('/api/transport/t1/boarding').send({
      student_ref: 'stu-1',
      direction: 'alight',
      leg: 'pickup',
      route_id: routeId,
      at: '2025-09-10T07:50:00.000Z',
    });
    expect(alight.status).toBe(200);
    expect(events.some((e) => e.type === 'school.transport.alighted')).toBe(true);
    expect(
      events.some(
        (e) =>
          e.type === 'school.transport.anomaly' &&
          e.data.kind === 'alight_without_board',
      ),
    ).toBe(true);
  });

  it('sweep idempotency + manifest states', async () => {
    const { routeId } = await seedRoute();
    await request(app).post('/api/transport/t1/boarding').send({
      student_ref: 'stu-1',
      direction: 'board',
      leg: 'pickup',
      route_id: routeId,
      at: '2025-09-10T07:31:00.000Z',
    });
    events.length = 0;

    const sweep1 = await request(app).post('/api/transport/t1/sweep-missed').send({
      route_id: routeId,
      leg: 'pickup',
      date: '2025-09-10',
    });
    expect(sweep1.body.emitted).toBe(1);
    expect(sweep1.body.skipped).toBe(false);
    expect(
      events.filter((e) => e.type === 'school.transport.missed_boarding'),
    ).toHaveLength(1);

    const sweep2 = await request(app).post('/api/transport/t1/sweep-missed').send({
      route_id: routeId,
      leg: 'pickup',
      date: '2025-09-10',
    });
    expect(sweep2.body.skipped).toBe(true);
    expect(sweep2.body.emitted).toBe(0);

    const manifest = await request(app).get(
      `/api/transport/t1/routes/${routeId}/manifest?date=2025-09-10`,
    );
    expect(manifest.status).toBe(200);
    const s1 = manifest.body.students.find(
      (s: { studentRef: string }) => s.studentRef === 'stu-1',
    );
    const s2 = manifest.body.students.find(
      (s: { studentRef: string }) => s.studentRef === 'stu-2',
    );
    expect(s1.pickup.boarded).toBe(true);
    expect(s1.pickup.missed).toBe(false);
    expect(s2.pickup.missed).toBe(true);
  });

  it('tenant isolation', async () => {
    const { routeId } = await seedRoute();
    await request(app).post('/api/transport/t1/bindings').send({
      student_ref: 'stu-1',
      payload_b64: cardB64,
    });
    const other = await request(app).post('/api/transport/t2/boarding').send({
      payload_b64: cardB64,
      direction: 'board',
      leg: 'pickup',
      route_id: routeId,
      at: '2025-09-10T07:31:00.000Z',
    });
    expect(other.status).toBe(404);
  });
});
