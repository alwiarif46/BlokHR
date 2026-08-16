import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolIdentityApp,
  type SchoolIdentitySqlite,
} from '../src/index';
import { staff, guardian, internalOnly, SECRET } from './helpers/auth';

function guardianPayload(overrides: Record<string, unknown> = {}) {
  return {
    first_name: 'Meera',
    last_name: 'Rao',
    relation: 'mother',
    phone: '9876543210',
    preferred_language: 'en',
    ...overrides,
  };
}

function studentPayload(overrides: Record<string, unknown> = {}) {
  return {
    admission_number: 'ADM-P903',
    first_name: 'Asha',
    last_name: 'Rao',
    dob: '2015-06-15',
    gender: 'female',
    admission_date: '2025-04-01',
    status: 'active',
    category: 'GEN',
    mother_name: 'Meera',
    father_name: 'Ravi',
    guardian_contact: '9876543210',
    photo_ref: 'photos/asha.jpg',
    ...overrides,
  };
}

describe('school-identity guardian students (P9-03)', () => {
  let app: Express;
  let db: SchoolIdentitySqlite;

  beforeEach(async () => {
    const created = await createSchoolIdentityApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('enriches students with photo_ref and class/section; guardian header gate', async () => {
    const g = await request(app)
      .post('/api/identity/t1/guardians').set(staff('admin'))
      .send(guardianPayload());
    const s = await request(app)
      .post('/api/identity/t1/students').set(staff('admin'))
      .send(studentPayload());
    await request(app)
      .post(`/api/identity/t1/students/${s.body.id}/guardians`).set(staff('admin'))
      .send({ guardian_id: g.body.id, is_primary: true });
    const session = await request(app).post('/api/identity/t1/sessions').set(staff('school_admin')).send({
      label: '2025-26',
      starts_on: '2025-04-01',
      ends_on: '2026-03-31',
      is_current: true,
    });
    await request(app)
      .post(`/api/identity/t1/students/${s.body.id}/enrol`).set(staff('admin'))
      .send({
        academic_session_id: session.body.id,
        class_label: '5',
        section: 'A',
        roll_number: '12',
        enrolled_on: '2025-04-01',
      });

    const staffList = await request(app)
      .get(`/api/identity/t1/guardians/${g.body.id}/students`)
      .set(staff('office'));
    expect(staffList.status).toBe(200);
    expect(staffList.body.students[0].photo_ref).toBe('photos/asha.jpg');
    expect(staffList.body.students[0].class_label).toBe('5');
    expect(staffList.body.students[0].section).toBe('A');

    const noSecret = await request(app)
      .get(`/api/identity/t1/guardians/${g.body.id}/students`)
      .set('X-Blok-Principal', 'guardian')
      .set('X-Blok-Guardian', g.body.id);
    expect(noSecret.status).toBe(401);

    const mismatch = await request(app)
      .get(`/api/identity/t1/guardians/${g.body.id}/students`)
      .set('X-Blok-Internal', SECRET)
      .set('X-Blok-Principal', 'guardian')
      .set('X-Blok-Guardian', 'other-guardian');
    expect(mismatch.status).toBe(403);

    const ok = await request(app)
      .get(`/api/identity/t1/guardians/${g.body.id}/students`)
      .set('X-Blok-Internal', SECRET)
      .set('X-Blok-Principal', 'guardian')
      .set('X-Blok-Guardian', g.body.id);
    expect(ok.status).toBe(200);
    expect(ok.body.students).toHaveLength(1);

    const cross = await request(app)
      .get(`/api/identity/t2/guardians/${g.body.id}/students`)
      .set('X-Blok-Internal', SECRET)
      .set('X-Blok-Principal', 'guardian')
      .set('X-Blok-Guardian', g.body.id);
    expect(cross.status).toBe(404);
  });
});
