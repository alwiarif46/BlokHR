import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolIdentityApp } from '../src/index';
import { staff, guardian, internalOnly, SECRET } from './helpers/auth';
import type { SchoolIdentitySqlite } from '../src/db';

const SECRET = 'test-internal-secret';

function studentPayload(overrides: Record<string, unknown> = {}) {
  return {
    admission_number: 'ADM-SEC-1',
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
    ...overrides,
  };
}

describe('school-identity internal student section (P13-01)', () => {
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

  it('returns section_ref from active enrolment; 404 without; rejects principal', async () => {
    const session = await request(app).post('/api/identity/t1/sessions').set(staff('school_admin')).send({
      label: '2025-26',
      starts_on: '2025-04-01',
      ends_on: '2026-03-31',
      is_current: true,
    });
    const student = await request(app)
      .post('/api/identity/t1/students').set(staff('admin'))
      .send(studentPayload());
    await request(app)
      .post(`/api/identity/t1/students/${student.body.id}/enrol`).set(staff('admin'))
      .send({
        academic_session_id: session.body.id,
        class_label: '5',
        section: 'A',
        roll_number: '12',
        enrolled_on: '2025-04-01',
      });

    const ok = await request(app)
      .get(`/api/identity/t1/internal/students/${student.body.id}/section`)
      .set('X-Blok-Internal', SECRET);
    expect(ok.status).toBe(200);
    expect(ok.body.section_ref).toBe('5|A');
    expect(ok.body.academic_session_id).toBe(session.body.id);

    const withPrincipal = await request(app)
      .get(`/api/identity/t1/internal/students/${student.body.id}/section`)
      .set('X-Blok-Internal', SECRET)
      .set('X-Blok-Principal', 'staff');
    expect(withPrincipal.status).toBe(403);
    expect(withPrincipal.body.error).toBe('internal_only');

    const noSecret = await request(app).get(
      `/api/identity/t1/internal/students/${student.body.id}/section`,
    );
    expect(noSecret.status).toBe(401);

    const none = await request(app)
      .get('/api/identity/t1/internal/students/missing/section')
      .set('X-Blok-Internal', SECRET);
    expect(none.status).toBe(404);
  });
});
