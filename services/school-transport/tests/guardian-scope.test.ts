import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolTransportApp,
  type SchoolTransportSqlite,
} from '../src/index';
import { SECRET, staff } from './helpers/auth';

function guardian(guardianId: string, studentRefs: string[] = []) {
  const h: Record<string, string> = {
    'X-Blok-Internal': SECRET,
    'X-Blok-Principal': 'guardian',
    'X-Blok-Guardian': guardianId,
  };
  if (studentRefs.length) {
    h['X-Blok-Students'] = studentRefs.join(',');
  }
  return h;
}

describe('school-transport guardian status scope', () => {
  let app: Express;
  let db: SchoolTransportSqlite;
  let studentRef: string;

  beforeEach(async () => {
    const created = await createSchoolTransportApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
    });
    app = created.app;
    db = created.db;
    studentRef = 'stu-1';

    const vehicle = await request(app)
      .post('/api/transport/t1/vehicles')
      .set(staff('school_admin'))
      .send({
        registration: 'KA01XY1111',
        capacity: 40,
        insurance_expiry: '2026-01-01',
        fitness_expiry: '2026-06-01',
      });
    const route = await request(app)
      .post('/api/transport/t1/routes')
      .set(staff('school_admin'))
      .send({
        label: 'North',
        vehicle_id: vehicle.body.id,
      });
    const stop = await request(app)
      .post(`/api/transport/t1/routes/${route.body.id}/stops`)
      .set(staff('school_admin'))
      .send({
        label: 'Gate',
        lat: 12.97,
        lng: 77.59,
        pickup_time: '07:30',
        drop_time: '14:00',
      });
    await request(app)
      .post(`/api/transport/t1/routes/${route.body.id}/students`)
      .set(staff('school_admin'))
      .send({ stop_id: stop.body.id, student_ref: studentRef });
  });

  afterEach(async () => {
    await db.close();
  });

  it('denies unlinked student and returns status shape for linked', async () => {
    const unlinked = await request(app)
      .get(`/api/transport/t1/guardian/students/stu-other/status`)
      .set(guardian('g1', [studentRef]));
    expect(unlinked.status).toBe(403);

    const noSecret = await request(app)
      .get(`/api/transport/t1/guardian/students/${studentRef}/status`)
      .set({
        'X-Blok-Principal': 'guardian',
        'X-Blok-Guardian': 'g1',
        'X-Blok-Students': studentRef,
      });
    expect(noSecret.status).toBe(401);

    const ok = await request(app)
      .get(`/api/transport/t1/guardian/students/${studentRef}/status`)
      .set(guardian('g1', [studentRef]));
    expect(ok.status).toBe(200);
    expect(ok.body.assignment).toBeTruthy();
    expect(ok.body.route).toBeTruthy();
    expect(ok.body.stop).toBeTruthy();
    expect(Array.isArray(ok.body.recentBoarding)).toBe(true);
    // Never leak raw person GPS fields on this surface.
    expect(JSON.stringify(ok.body)).not.toMatch(/personGps|person_gps|rawGps/i);
  });
});
