import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolAcademicsApp,
  selectDeterministicSample,
  type DomainEvent,
  type EventPublisher,
  type SchoolAcademicsSqlite,
} from '../src/index';

class RecordingPublisher implements EventPublisher {
  events: DomainEvent[] = [];
  async publish(e: DomainEvent): Promise<void> {
    this.events.push(e);
  }
}

describe('school-academics lessons (P3-03)', () => {
  let app: Express;
  let db: SchoolAcademicsSqlite;
  let publisher: RecordingPublisher;
  let courseId: string;
  let unitId: string;

  beforeEach(async () => {
    publisher = new RecordingPublisher();
    const created = await createSchoolAcademicsApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      eventPublisher: publisher,
    });
    app = created.app;
    db = created.db;

    const course = await request(app).post('/api/academics/t1/courses').set(staff('school_admin')).send({
      academic_session_id: 'ay-2025',
      board: 'cbse',
      subject_code: 'Sc',
      class_label: '8',
      label: 'Science 8',
    });
    courseId = course.body.id;
    const unit = await request(app)
      .post(`/api/academics/t1/courses/${courseId}/units`).set(staff('school_admin'))
      .send({ label: 'Unit 1', planned_weeks: 2 });
    unitId = unit.body.id;
  });

  afterEach(async () => {
    await db.close();
  });

  async function createDraft(overrides: Record<string, unknown> = {}) {
    const res = await request(app)
      .post('/api/academics/t1/lessons').set(staff('school_admin'))
      .send({
        course_id: courseId,
        unit_id: unitId,
        teacher_member_id: 'teacher-1',
        week_start: '2025-09-01',
        title: 'Lesson A',
        body: {
          objectives: ['o1'],
          activities: ['a1'],
          materials: [],
          assessment_check: null,
        },
        provenance: 'human',
        ...overrides,
      });
    expect(res.status).toBe(201);
    return res.body as { id: string; state: string; provenance: string };
  }

  it('state machine: editable draft/changes_requested; submitted/approved locked', async () => {
    const draft = await createDraft({ title: 'Editable' });
    const patched = await request(app)
      .patch(`/api/academics/t1/lessons/${draft.id}`).set(staff('school_admin'))
      .send({ title: 'Edited' });
    expect(patched.status).toBe(200);
    expect(patched.body.title).toBe('Edited');

    await request(app).post('/api/academics/t1/lessons/submit-week').set(staff('school_admin')).send({
      teacher_member_id: 'teacher-1',
      week_start: '2025-09-01',
    });

    const locked = await request(app)
      .patch(`/api/academics/t1/lessons/${draft.id}`).set(staff('school_admin'))
      .send({ title: 'Nope' });
    expect(locked.status).toBe(409);

    const reviewed = await request(app)
      .post(`/api/academics/t1/lessons/${draft.id}/review`).set(staff('school_admin'))
      .send({
        decision: 'changes_requested',
        reviewed_by: 'hod-1',
        review_note: 'Add assessment check',
      });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.state).toBe('changes_requested');

    const reedit = await request(app)
      .patch(`/api/academics/t1/lessons/${draft.id}`).set(staff('school_admin'))
      .send({ title: 'Fixed' });
    expect(reedit.status).toBe(200);

    // Re-create as draft path for approved lock: new lesson
    const d2 = await createDraft({ title: 'To approve', week_start: '2025-09-08' });
    await request(app).post('/api/academics/t1/lessons/submit-week').set(staff('school_admin')).send({
      teacher_member_id: 'teacher-1',
      week_start: '2025-09-08',
    });
    await request(app)
      .post(`/api/academics/t1/lessons/${d2.id}/review`).set(staff('school_admin'))
      .send({ decision: 'approved', reviewed_by: 'hod-1' });
    const approvedLock = await request(app)
      .patch(`/api/academics/t1/lessons/${d2.id}`).set(staff('school_admin'))
      .send({ title: 'Nope2' });
    expect(approvedLock.status).toBe(409);
  });

  it('bulk submit emits one week_submitted event', async () => {
    await createDraft({ title: 'L1' });
    await createDraft({ title: 'L2' });
    const res = await request(app).post('/api/academics/t1/lessons/submit-week').set(staff('school_admin')).send({
      teacher_member_id: 'teacher-1',
      week_start: '2025-09-01',
    });
    expect(res.status).toBe(200);
    expect(res.body.lessons).toHaveLength(2);
    expect(res.body.lessons.every((l: { state: string }) => l.state === 'submitted')).toBe(
      true,
    );
    const weekEvents = publisher.events.filter((e) => e.type === 'school.lessons.week_submitted');
    expect(weekEvents).toHaveLength(1);
    expect(weekEvents[0].data.count).toBe(2);
  });

  it('changes_requested requires review_note', async () => {
    const draft = await createDraft();
    await request(app).post('/api/academics/t1/lessons/submit-week').set(staff('school_admin')).send({
      teacher_member_id: 'teacher-1',
      week_start: '2025-09-01',
    });
    const bad = await request(app)
      .post(`/api/academics/t1/lessons/${draft.id}/review`).set(staff('school_admin'))
      .send({ decision: 'changes_requested', reviewed_by: 'hod' });
    expect(bad.status).toBe(400);
  });

  it('deterministic review-sample is stable', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const d = await createDraft({
        title: `L${i}`,
        week_start: '2025-10-06',
        teacher_member_id: 'teacher-2',
      });
      ids.push(d.id);
    }
    await request(app).post('/api/academics/t1/lessons/submit-week').set(staff('school_admin')).send({
      teacher_member_id: 'teacher-2',
      week_start: '2025-10-06',
    });
    for (const id of ids) {
      await request(app)
        .post(`/api/academics/t1/lessons/${id}/review`).set(staff('school_admin'))
        .send({ decision: 'approved', reviewed_by: 'hod' });
    }

    const a = await request(app).get(
      '/api/academics/t1/lessons/review-sample?week_start=2025-10-06&pct=20',
    ).set(staff('school_admin'));
    const b = await request(app).get(
      '/api/academics/t1/lessons/review-sample?week_start=2025-10-06&pct=20',
    ).set(staff('school_admin'));
    expect(a.status).toBe(200);
    expect(a.body.lessons.length).toBe(2); // 20% of 10
    expect(a.body.lessons.map((l: { id: string }) => l.id)).toEqual(
      b.body.lessons.map((l: { id: string }) => l.id),
    );

    const expected = selectDeterministicSample(
      ids.map((id) => ({ id })),
      't1|2025-10-06',
      20,
    ).map((x) => x.id);
    expect(a.body.lessons.map((l: { id: string }) => l.id).sort()).toEqual(
      [...expected].sort(),
    );
  });

  it('stale list and provenance persisted', async () => {
    const draft = await createDraft({ provenance: 'ai_assisted', title: 'Stale candidate' });
    expect(draft.provenance).toBe('ai_assisted');

    await request(app).post('/api/academics/t1/lessons/submit-week').set(staff('school_admin')).send({
      teacher_member_id: 'teacher-1',
      week_start: '2025-09-01',
    });

    await db.run(
      `UPDATE lesson_plans SET updated_at = datetime('now', '-30 days') WHERE id = ?`,
      [draft.id],
    );

    const stale = await request(app).get('/api/academics/t1/lessons/stale?days=21').set(staff('school_admin'));
    expect(stale.status).toBe(200);
    expect(stale.body.lessons.some((l: { id: string }) => l.id === draft.id)).toBe(true);
  });

  it('tenant isolation for lessons', async () => {
    const course2 = await request(app).post('/api/academics/t2/courses').set(staff('school_admin')).send({
      academic_session_id: 'ay-2025',
      board: 'cbse',
      subject_code: 'Sc',
      class_label: '8',
      label: 'Science 8',
    });
    const unit2 = await request(app)
      .post(`/api/academics/t2/courses/${course2.body.id}/units`).set(staff('school_admin'))
      .send({ label: 'U', planned_weeks: 1 });

    const l1 = await createDraft({ title: 'T1 only' });
    await request(app).post('/api/academics/t2/lessons').set(staff('school_admin')).send({
      course_id: course2.body.id,
      unit_id: unit2.body.id,
      teacher_member_id: 'teacher-1',
      week_start: '2025-09-01',
      title: 'T2 lesson',
    });

    const list1 = await request(app).get('/api/academics/t1/lessons').set(staff('school_admin'));
    const list2 = await request(app).get('/api/academics/t2/lessons').set(staff('school_admin'));
    expect(list1.body.lessons).toHaveLength(1);
    expect(list1.body.lessons[0].id).toBe(l1.id);
    expect(list2.body.lessons).toHaveLength(1);
    expect(list2.body.lessons[0].id).not.toBe(l1.id);
  });
});
