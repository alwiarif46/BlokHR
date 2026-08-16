import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolTimetableApp,
  type DomainEvent,
  type EventPublisher,
} from '../src/index';
import type { SchoolTimetableSqlite } from '../src/db';

class RecordingPublisher implements EventPublisher {
  events: DomainEvent[] = [];
  async publish(e: DomainEvent): Promise<void> {
    this.events.push(e);
  }
}

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
      start_time: '09:45',
      end_time: '10:30',
      is_teaching: 1,
    },
  ];
}

describe('school-timetable period instances', () => {
  let app: Express;
  let db: SchoolTimetableSqlite;
  let publisher: RecordingPublisher;

  beforeEach(async () => {
    publisher = new RecordingPublisher();
    const created = await createSchoolTimetableApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      eventPublisher: publisher,
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  async function setupWeekly(tenant = 't1') {
    const scheme = await request(app).post(`/api/timetable/${tenant}/day-schemes`).set(staff('school_admin')).send({
      label: 'Weekly',
      kind: 'weekly',
      periods: periodsOk(),
    });
    const section = await request(app).post(`/api/timetable/${tenant}/sections`).set(staff('school_admin')).send({
      academic_session_id: 'sess-1',
      class_label: '8',
      section: 'A',
      day_scheme_id: scheme.body.id,
    });
    const subject = await request(app).post(`/api/timetable/${tenant}/subjects`).set(staff('school_admin')).send({
      code: 'MATH',
      label: 'Mathematics',
    });
    const allocation = await request(app).post(`/api/timetable/${tenant}/allocations`).set(staff('school_admin')).send({
      section_id: section.body.id,
      subject_id: subject.body.id,
      teacher_member_id: 'teacher-1',
      periods_per_week: 5,
    });
    await request(app)
      .put(`/api/timetable/${tenant}/sections/${section.body.id}/slots`).set(staff('school_admin'))
      .send([
        { day_ref: 'mon', period_index: 0, allocation_id: allocation.body.id },
        { day_ref: 'mon', period_index: 1, allocation_id: allocation.body.id },
        { day_ref: 'tue', period_index: 0, allocation_id: allocation.body.id },
        { day_ref: 'wed', period_index: 0, allocation_id: allocation.body.id },
      ]);
    return { sectionId: section.body.id as string, allocationId: allocation.body.id as string };
  }

  async function setupCyclic(tenant = 't1') {
    const scheme = await request(app).post(`/api/timetable/${tenant}/day-schemes`).set(staff('school_admin')).send({
      label: '2-day',
      kind: 'cyclic',
      cycle_length: 2,
      periods: periodsOk(),
    });
    const section = await request(app).post(`/api/timetable/${tenant}/sections`).set(staff('school_admin')).send({
      academic_session_id: 'sess-1',
      class_label: '8',
      section: 'A',
      day_scheme_id: scheme.body.id,
    });
    const subject = await request(app).post(`/api/timetable/${tenant}/subjects`).set(staff('school_admin')).send({
      code: 'SCI',
      label: 'Science',
    });
    const allocation = await request(app).post(`/api/timetable/${tenant}/allocations`).set(staff('school_admin')).send({
      section_id: section.body.id,
      subject_id: subject.body.id,
      teacher_member_id: 'teacher-2',
      periods_per_week: 4,
    });
    await request(app)
      .put(`/api/timetable/${tenant}/sections/${section.body.id}/slots`).set(staff('school_admin'))
      .send([
        { day_ref: 'd1', period_index: 0, allocation_id: allocation.body.id },
        { day_ref: 'd2', period_index: 1, allocation_id: allocation.body.id },
      ]);
    return { sectionId: section.body.id as string };
  }

  it('generates weekly scheduled instances and maps exclusions to lost', async () => {
    const { sectionId } = await setupWeekly();

    // 2025-08-11 = Monday, 2025-08-12 = Tuesday, 2025-08-15 = Friday
    await request(app).post('/api/timetable/t1/exclusions').set(staff('school_admin')).send({
      date: '2025-08-12',
      scope: 'school',
      reason: 'holiday',
      label: 'Local holiday',
    });

    const gen = await request(app)
      .post(`/api/timetable/t1/sections/${sectionId}/instances/generate`).set(staff('school_admin'))
      .send({ from: '2025-08-11', to: '2025-08-12' });
    expect(gen.status).toBe(200);
    expect(gen.body.created).toBe(2);
    expect(gen.body.lost).toBe(1);

    const list = await request(app).get(
      `/api/timetable/t1/sections/${sectionId}/instances?from=2025-08-11&to=2025-08-12`,
    ).set(staff('school_admin'));
    expect(list.status).toBe(200);
    expect(list.body.instances).toHaveLength(3);

    const mon = list.body.instances.filter((i: { date: string }) => i.date === '2025-08-11');
    expect(mon).toHaveLength(2);
    expect(mon.every((i: { status: string }) => i.status === 'scheduled')).toBe(true);

    const tue = list.body.instances.find((i: { date: string }) => i.date === '2025-08-12');
    expect(tue.status).toBe('lost');
    expect(tue.lostReason).toBe('holiday');
  });

  it('cyclic counter does not advance on fully excluded days', async () => {
    const { sectionId } = await setupCyclic();

    // Mon 11, Tue 12 (holiday), Wed 13
    await request(app).post('/api/timetable/t1/exclusions').set(staff('school_admin')).send({
      date: '2025-08-12',
      scope: 'school',
      reason: 'holiday',
      label: 'Holiday',
    });

    const gen = await request(app)
      .post(`/api/timetable/t1/sections/${sectionId}/instances/generate`).set(staff('school_admin'))
      .send({ from: '2025-08-11', to: '2025-08-13' });
    expect(gen.status).toBe(200);

    const list = await request(app).get(
      `/api/timetable/t1/sections/${sectionId}/instances?from=2025-08-11&to=2025-08-13`,
    ).set(staff('school_admin'));
    const byDate = Object.fromEntries(
      list.body.instances.map((i: { date: string; periodIndex: number; status: string }) => [
        i.date,
        i,
      ]),
    );

    // Mon uses d1 → period 0 scheduled, then advances
    expect(byDate['2025-08-11'].periodIndex).toBe(0);
    expect(byDate['2025-08-11'].status).toBe('scheduled');

    // Tue excluded uses current d2 → period 1 lost, does NOT advance
    expect(byDate['2025-08-12'].periodIndex).toBe(1);
    expect(byDate['2025-08-12'].status).toBe('lost');

    // Wed still on d2 (counter held) → period 1 scheduled
    expect(byDate['2025-08-13'].periodIndex).toBe(1);
    expect(byDate['2025-08-13'].status).toBe('scheduled');
  });

  it('is idempotent and preserves held rows', async () => {
    const { sectionId } = await setupWeekly();

    const first = await request(app)
      .post(`/api/timetable/t1/sections/${sectionId}/instances/generate`).set(staff('school_admin'))
      .send({ from: '2025-08-11', to: '2025-08-11' });
    expect(first.body.created).toBe(2);

    const list = await request(app).get(
      `/api/timetable/t1/sections/${sectionId}/instances?from=2025-08-11&to=2025-08-11`,
    ).set(staff('school_admin'));
    const holdId = list.body.instances[0].id as string;
    const held = await request(app)
      .patch(`/api/timetable/t1/instances/${holdId}`).set(staff('school_admin'))
      .send({ status: 'held' });
    expect(held.status).toBe(200);
    expect(held.body.status).toBe('held');

    const second = await request(app)
      .post(`/api/timetable/t1/sections/${sectionId}/instances/generate`).set(staff('school_admin'))
      .send({ from: '2025-08-11', to: '2025-08-11' });
    expect(second.body.created).toBe(0);
    expect(second.body.skipped).toBe(2);

    const after = await request(app).get(
      `/api/timetable/t1/sections/${sectionId}/instances?from=2025-08-11&to=2025-08-11`,
    ).set(staff('school_admin'));
    const stillHeld = after.body.instances.find((i: { id: string }) => i.id === holdId);
    expect(stillHeld.status).toBe('held');
  });

  it('enforces status transitions and emits school.period.lost', async () => {
    const { sectionId } = await setupWeekly();
    await request(app)
      .post(`/api/timetable/t1/sections/${sectionId}/instances/generate`).set(staff('school_admin'))
      .send({ from: '2025-08-11', to: '2025-08-11' });

    const list = await request(app).get(
      `/api/timetable/t1/sections/${sectionId}/instances?from=2025-08-11&to=2025-08-11`,
    ).set(staff('school_admin'));
    const id = list.body.instances[0].id as string;

    const lost = await request(app)
      .patch(`/api/timetable/t1/instances/${id}`).set(staff('school_admin'))
      .send({ status: 'lost', lost_reason: 'event' });
    expect(lost.status).toBe(200);
    expect(lost.body.status).toBe('lost');
    expect(publisher.events.some((e) => e.type === 'school.period.lost')).toBe(true);

    const back = await request(app)
      .patch(`/api/timetable/t1/instances/${id}`).set(staff('school_admin'))
      .send({ status: 'scheduled' });
    expect(back.status).toBe(200);
    expect(back.body.status).toBe('scheduled');
    expect(back.body.lostReason).toBeNull();

    await request(app).patch(`/api/timetable/t1/instances/${id}`).set(staff('school_admin')).send({ status: 'held' });
    const illegal = await request(app)
      .patch(`/api/timetable/t1/instances/${id}`).set(staff('school_admin'))
      .send({ status: 'scheduled' });
    expect(illegal.status).toBe(409);
    expect(illegal.body.error).toMatch(/terminal|held/i);
  });

  it('isolates tenants', async () => {
    const { sectionId } = await setupWeekly('tenant-a');
    await request(app)
      .post(`/api/timetable/tenant-a/sections/${sectionId}/instances/generate`).set(staff('school_admin'))
      .send({ from: '2025-08-11', to: '2025-08-11' });

    const b = await request(app).get(
      `/api/timetable/tenant-b/sections/${sectionId}/instances?from=2025-08-11&to=2025-08-11`,
    ).set(staff('school_admin'));
    expect(b.status).toBe(404);
  });
});
