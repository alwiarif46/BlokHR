import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolTimetableApp } from '../src/index';
import type { SchoolTimetableSqlite } from '../src/db';

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
      label: 'Break',
      start_time: '09:45',
      end_time: '10:00',
      is_teaching: 0,
    },
    {
      index: 2,
      label: 'P2',
      start_time: '10:00',
      end_time: '10:45',
      is_teaching: 1,
    },
  ];
}

describe('school-timetable calendar', () => {
  let app: Express;
  let db: SchoolTimetableSqlite;

  beforeEach(async () => {
    const created = await createSchoolTimetableApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('CRUD terms', async () => {
    const created = await request(app).post('/api/timetable/t1/terms').send({
      academic_session_id: 'sess-1',
      label: 'Term 1',
      starts_on: '2025-04-01',
      ends_on: '2025-09-30',
    });
    expect(created.status).toBe(201);
    expect(created.body.label).toBe('Term 1');
    expect(created.body.academicSessionId).toBe('sess-1');

    const list = await request(app).get('/api/timetable/t1/terms');
    expect(list.status).toBe(200);
    expect(list.body.terms).toHaveLength(1);

    const got = await request(app).get(`/api/timetable/t1/terms/${created.body.id}`);
    expect(got.status).toBe(200);
    expect(got.body.id).toBe(created.body.id);

    const patched = await request(app)
      .patch(`/api/timetable/t1/terms/${created.body.id}`)
      .send({ label: 'Term One' });
    expect(patched.status).toBe(200);
    expect(patched.body.label).toBe('Term One');

    const del = await request(app).delete(`/api/timetable/t1/terms/${created.body.id}`);
    expect(del.status).toBe(204);
    const after = await request(app).get('/api/timetable/t1/terms');
    expect(after.body.terms).toHaveLength(0);
  });

  it('CRUD day-schemes and rejects overlapping periods', async () => {
    const created = await request(app).post('/api/timetable/t1/day-schemes').send({
      label: 'Mon-Fri',
      kind: 'weekly',
      periods: periodsOk(),
    });
    expect(created.status).toBe(201);
    expect(created.body.periods).toHaveLength(3);
    expect(created.body.periods[0].isTeaching).toBe(true);

    const list = await request(app).get('/api/timetable/t1/day-schemes');
    expect(list.body.daySchemes).toHaveLength(1);

    const overlap = await request(app).post('/api/timetable/t1/day-schemes').send({
      label: 'Bad',
      kind: 'weekly',
      periods: [
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
          start_time: '09:30',
          end_time: '10:15',
          is_teaching: 1,
        },
      ],
    });
    expect(overlap.status).toBe(400);
    expect(overlap.body.error).toMatch(/overlap/i);

    const noTeach = await request(app).post('/api/timetable/t1/day-schemes').send({
      label: 'Breaks only',
      kind: 'weekly',
      periods: [
        {
          index: 0,
          label: 'Break',
          start_time: '09:00',
          end_time: '09:15',
          is_teaching: 0,
        },
      ],
    });
    expect(noTeach.status).toBe(400);

    const cyclic = await request(app).post('/api/timetable/t1/day-schemes').send({
      label: '6-day',
      kind: 'cyclic',
      cycle_length: 6,
      periods: periodsOk(),
    });
    expect(cyclic.status).toBe(201);
    expect(cyclic.body.cycleLength).toBe(6);

    const patched = await request(app)
      .patch(`/api/timetable/t1/day-schemes/${created.body.id}`)
      .send({ label: 'Standard week' });
    expect(patched.status).toBe(200);
    expect(patched.body.label).toBe('Standard week');

    const del = await request(app).delete(
      `/api/timetable/t1/day-schemes/${created.body.id}`,
    );
    expect(del.status).toBe(204);
  });

  it('CRUD exclusions with range query', async () => {
    const a = await request(app).post('/api/timetable/t1/exclusions').send({
      date: '2025-08-15',
      scope: 'school',
      reason: 'holiday',
      label: 'Independence Day',
    });
    expect(a.status).toBe(201);

    const b = await request(app).post('/api/timetable/t1/exclusions').send({
      date: '2025-09-01',
      scope: 'class',
      class_label: '8',
      reason: 'exam',
      label: 'Unit test',
    });
    expect(b.status).toBe(201);

    const c = await request(app).post('/api/timetable/t1/exclusions').send({
      date: '2025-10-02',
      scope: 'school',
      reason: 'holiday',
      label: 'Gandhi Jayanti',
    });
    expect(c.status).toBe(201);

    const range = await request(app).get(
      '/api/timetable/t1/exclusions?from=2025-08-01&to=2025-09-30',
    );
    expect(range.status).toBe(200);
    expect(range.body.exclusions).toHaveLength(2);
    expect(range.body.exclusions.map((e: { label: string }) => e.label)).toEqual([
      'Independence Day',
      'Unit test',
    ]);

    const patched = await request(app)
      .patch(`/api/timetable/t1/exclusions/${b.body.id}`)
      .send({ label: 'Class 8 unit test' });
    expect(patched.status).toBe(200);
    expect(patched.body.label).toBe('Class 8 unit test');

    const del = await request(app).delete(`/api/timetable/t1/exclusions/${a.body.id}`);
    expect(del.status).toBe(204);
  });

  it('isolates tenants', async () => {
    await request(app).post('/api/timetable/tenant-a/terms').send({
      academic_session_id: 's1',
      label: 'A term',
      starts_on: '2025-04-01',
      ends_on: '2025-09-30',
    });
    await request(app).post('/api/timetable/tenant-a/day-schemes').send({
      label: 'A scheme',
      kind: 'weekly',
      periods: periodsOk(),
    });
    await request(app).post('/api/timetable/tenant-a/exclusions').send({
      date: '2025-08-15',
      scope: 'school',
      reason: 'holiday',
      label: 'A holiday',
    });

    const terms = await request(app).get('/api/timetable/tenant-b/terms');
    expect(terms.body.terms).toHaveLength(0);
    const schemes = await request(app).get('/api/timetable/tenant-b/day-schemes');
    expect(schemes.body.daySchemes).toHaveLength(0);
    const exclusions = await request(app).get('/api/timetable/tenant-b/exclusions');
    expect(exclusions.body.exclusions).toHaveLength(0);

    const aTerms = await request(app).get('/api/timetable/tenant-a/terms');
    expect(aTerms.body.terms).toHaveLength(1);
  });
});
