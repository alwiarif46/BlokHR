import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolIdentityApp,
  getStatePack,
  listStatePacks,
  type EventPublisher,
  type DomainEvent,
} from '../src/index';
import type { SchoolIdentitySqlite } from '../src/db';

class RecordingPublisher implements EventPublisher {
  events: DomainEvent[] = [];
  async publish(e: DomainEvent): Promise<void> {
    this.events.push(e);
  }
}

function studentPayload(overrides: Record<string, unknown> = {}) {
  return {
    admission_number: 'ADM-001',
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
    aadhaar_last4: '1234',
    ...overrides,
  };
}

describe('school-identity state packs', () => {
  let app: Express;
  let db: SchoolIdentitySqlite;

  beforeEach(async () => {
    const created = await createSchoolIdentityApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      eventPublisher: new RecordingPublisher(),
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('registry contains MH, TN, KA with expected shapes', () => {
    const codes = listStatePacks().map((p) => p.code).sort();
    expect(codes).toEqual(['KA', 'MH', 'TN']);

    const mh = getStatePack('MH')!;
    expect(mh.categories.map((c) => c.code)).toEqual([
      'GEN',
      'SC',
      'ST',
      'VJNT-A',
      'NT-B',
      'NT-C',
      'NT-D',
      'OBC',
      'SBC',
      'EWS',
    ]);
    expect(mh.scripts).toEqual(['deva']);
    expect(mh.gradeSchemes).toHaveLength(2);
    expect(mh.gradeSchemes[0].board).toBe('MSBSHSE SSC');
    expect(mh.gradeSchemes[0].labels).toHaveLength(6);
    expect(mh.gradeSchemes[1].board).toBe('MSBSHSE HSC');
    expect(mh.gradeSchemes[1].labels).toHaveLength(5);

    const tn = getStatePack('TN')!;
    expect(tn.categories).toHaveLength(8);
    expect(tn.studentIdField?.label).toBe('EMIS');
    expect(tn.studentIdField?.pattern).toBe('^\\d{8}$');
    expect(tn.scripts).toEqual(['taml']);

    const ka = getStatePack('KA')!;
    expect(ka.categories.map((c) => c.code)).toContain('OBC-2A');
    expect(ka.studentIdField?.label).toBe('SATS');
    expect(ka.scripts).toEqual(['knda']);
  });

  it('lists and fetches packs via API; sets tenant pack', async () => {
    const list = await request(app).get('/api/identity/state-packs');
    expect(list.status).toBe(200);
    expect(list.body.packs).toEqual(
      expect.arrayContaining([
        { code: 'MH', label: 'Maharashtra' },
        { code: 'TN', label: 'Tamil Nadu' },
        { code: 'KA', label: 'Karnataka' },
      ]),
    );

    const detail = await request(app).get('/api/identity/state-packs/TN');
    expect(detail.status).toBe(200);
    expect(detail.body.code).toBe('TN');
    expect(detail.body.studentIdField.label).toBe('EMIS');

    const set = await request(app)
      .put('/api/identity/t1/state-pack')
      .send({ pack_code: 'TN' });
    expect(set.status).toBe(200);
    expect(set.body.packCode).toBe('TN');

    const got = await request(app).get('/api/identity/t1/state-pack');
    expect(got.status).toBe(200);
    expect(got.body.packCode).toBe('TN');
  });

  it('enforces TN EMIS pattern and category codes when pack is set', async () => {
    await request(app).put('/api/identity/t1/state-pack').send({ pack_code: 'TN' });

    const badId = await request(app)
      .post('/api/identity/t1/students')
      .send(
        studentPayload({
          state_student_id: '123',
          state_category_code: 'BC',
        }),
      );
    expect(badId.status).toBe(400);
    expect(badId.body.error).toMatch(/EMIS/);

    const badCat = await request(app)
      .post('/api/identity/t1/students')
      .send(
        studentPayload({
          admission_number: 'ADM-002',
          state_student_id: '12345678',
          state_category_code: 'GEN',
        }),
      );
    expect(badCat.status).toBe(400);
    expect(badCat.body.error).toMatch(/state_category_code/);

    const ok = await request(app)
      .post('/api/identity/t1/students')
      .send(
        studentPayload({
          admission_number: 'ADM-003',
          state_student_id: '12345678',
          state_category_code: 'MBC',
        }),
      );
    expect(ok.status).toBe(201);
    expect(ok.body.stateStudentId).toBe('12345678');
    expect(ok.body.stateCategoryCode).toBe('MBC');
  });

  it('skips pack validation when tenant has no state pack', async () => {
    const res = await request(app)
      .post('/api/identity/t2/students')
      .send(
        studentPayload({
          state_student_id: 'not-an-emis',
          state_category_code: 'ANYTHING',
        }),
      );
    expect(res.status).toBe(201);
    expect(res.body.stateStudentId).toBe('not-an-emis');
    expect(res.body.stateCategoryCode).toBe('ANYTHING');
  });
});
