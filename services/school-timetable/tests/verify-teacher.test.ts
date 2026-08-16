import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolTimetableApp } from '../src/index';
import type { SchoolTimetableSqlite } from '../src/db';
import { staff, internalOnly } from './helpers/auth';

function periodsOk() {
  return [
    {
      index: 0,
      label: 'P1',
      start_time: '09:00',
      end_time: '09:45',
      is_teaching: 1,
    },
    {
      index: 1,
      label: 'P2',
      start_time: '10:00',
      end_time: '10:45',
      is_teaching: 1,
    },
  ];
}

describe('school-timetable verify-teacher (P12-05)', () => {
  let app: Express;
  let db: SchoolTimetableSqlite;
  let sectionA: string;
  let sectionB: string;
  let allocA: string;
  let instanceId: string;

  beforeEach(async () => {
    const created = await createSchoolTimetableApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
    });
    app = created.app;
    db = created.db;

    const scheme = await request(app)
      .post('/api/timetable/t1/day-schemes')
      .set(staff('school_admin'))
      .send({ label: 'W', kind: 'weekly', periods: periodsOk() });
    const secA = await request(app)
      .post('/api/timetable/t1/sections')
      .set(staff('school_admin'))
      .send({
        academic_session_id: 'sess-1',
        class_label: '8',
        section: 'A',
        day_scheme_id: scheme.body.id,
      });
    const secB = await request(app)
      .post('/api/timetable/t1/sections')
      .set(staff('school_admin'))
      .send({
        academic_session_id: 'sess-1',
        class_label: '8',
        section: 'B',
        day_scheme_id: scheme.body.id,
      });
    sectionA = secA.body.id;
    sectionB = secB.body.id;

    const subj = await request(app)
      .post('/api/timetable/t1/subjects')
      .set(staff('school_admin'))
      .send({ code: 'M', label: 'Math' });
    const aA = await request(app)
      .post('/api/timetable/t1/allocations')
      .set(staff('school_admin'))
      .send({
        section_id: sectionA,
        subject_id: subj.body.id,
        teacher_member_id: 'teacher-a',
        periods_per_week: 2,
      });
    await request(app)
      .post('/api/timetable/t1/allocations')
      .set(staff('school_admin'))
      .send({
        section_id: sectionB,
        subject_id: subj.body.id,
        teacher_member_id: 'teacher-b',
        periods_per_week: 2,
      });
    allocA = aA.body.id;

    await request(app)
      .put(`/api/timetable/t1/sections/${sectionA}/slots`)
      .set(staff('school_admin'))
      .send([{ day_ref: 'mon', period_index: 0, allocation_id: allocA }]);

    const gen = await request(app)
      .post(`/api/timetable/t1/sections/${sectionA}/instances/generate`)
      .set(staff('school_admin'))
      .send({ from: '2025-09-01', to: '2025-09-01' });
    expect(gen.status).toBe(200);

    const list = await request(app)
      .get(`/api/timetable/t1/sections/${sectionA}/instances?from=2025-09-01&to=2025-09-01`)
      .set(staff('school_admin'));
    instanceId = list.body.instances[0].id;
  });

  afterEach(async () => {
    await db.close();
  });

  it('allows teacher on own section_ref and period instance', async () => {
    const bySec = await request(app)
      .post('/api/timetable/t1/internal/verify-teacher')
      .set(internalOnly())
      .send({ teacher_member_id: 'teacher-a', section_ref: '8A' });
    expect(bySec.status).toBe(200);
    expect(bySec.body.allowed).toBe(true);

    const byPi = await request(app)
      .post('/api/timetable/t1/internal/verify-teacher')
      .set(internalOnly())
      .send({ teacher_member_id: 'teacher-a', period_instance_id: instanceId });
    expect(byPi.status).toBe(200);
    expect(byPi.body.allowed).toBe(true);
  });

  it('denies teacher on another section', async () => {
    const res = await request(app)
      .post('/api/timetable/t1/internal/verify-teacher')
      .set(internalOnly())
      .send({ teacher_member_id: 'teacher-a', section_ref: '8B' });
    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(false);
  });

  it('requires internal secret (no staff principal)', async () => {
    const res = await request(app)
      .post('/api/timetable/t1/internal/verify-teacher')
      .set(staff('school_admin'))
      .send({ teacher_member_id: 'teacher-a', section_ref: '8A' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('internal_only');
  });
});
