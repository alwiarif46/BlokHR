import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolEngagementApp,
  createStubIdentityClient,
  createStubTimetableClient,
  ENGAGEMENT_ROUTE_POLICIES,
  type DomainEvent,
  type EventPublisher,
  type SchoolEngagementSqlite,
} from '../src/index';
import { SECRET, staff, guardian, internalOnly } from './helpers/auth';

class RecordingPublisher implements EventPublisher {
  events: DomainEvent[] = [];
  async publish(e: DomainEvent): Promise<void> {
    this.events.push(e);
  }
}

describe('school-engagement diary (P13-01)', () => {
  let app: Express;
  let db: SchoolEngagementSqlite;
  let clock: { now: Date };
  let events: RecordingPublisher;
  let allowedSections: Set<string>;
  const teacher = staff('teacher', 'member-teacher-1');
  const teacherOther = staff('teacher', 'member-teacher-2');
  const office = staff('office');
  const admin = staff('school_admin');
  const sectionA = '5|A';
  const sectionB = '5|B';

  beforeEach(async () => {
    clock = { now: new Date('2025-09-10T12:00:00.000Z') };
    events = new RecordingPublisher();
    allowedSections = new Set([sectionA]);
    const created = await createSchoolEngagementApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
      clock: () => clock.now,
      eventPublisher: events,
      timetableClient: createStubTimetableClient(allowedSections),
      identityClient: createStubIdentityClient({
        child1: { sectionRef: sectionA, academicSessionId: 'sess-1' },
        child2: { sectionRef: sectionB, academicSessionId: 'sess-1' },
      }),
    });
    app = created.app;
    db = created.db;

    await request(app)
      .put('/api/engagement/t1/guardians/g1/channels')
      .set(admin)
      .send({
        channels: [
          { channel: 'whatsapp', address: '+911', priority: 1, verified: true },
        ],
      });
  });

  afterEach(async () => {
    await db.close();
  });

  it('CRUD + immutables + author window + delete roles', async () => {
    const created = await request(app)
      .post('/api/engagement/t1/diary')
      .set(teacher)
      .send({
        section_ref: sectionA,
        entry_date: '2025-09-10',
        kind: 'homework',
        body: 'Read chapter 3',
      });
    expect(created.status).toBe(201);
    expect(created.body.acks).toBe(0);
    expect(created.body.guardians_total).toBeNull();
    expect(events.events.some((e) => e.type === 'school.diary.created')).toBe(true);
    const id = created.body.id as string;

    const patched = await request(app)
      .patch(`/api/engagement/t1/diary/${id}`)
      .set(teacher)
      .send({ body: 'Read chapter 3–4', kind: 'note' });
    expect(patched.status).toBe(200);
    expect(patched.body.body).toContain('3–4');
    expect(patched.body.kind).toBe('note');

    const immutable = await request(app)
      .patch(`/api/engagement/t1/diary/${id}`)
      .set(teacher)
      .send({ section_ref: sectionB });
    expect(immutable.status).toBe(400);

    const otherAuthor = await request(app)
      .patch(`/api/engagement/t1/diary/${id}`)
      .set(teacherOther)
      .send({ body: 'hijack' });
    expect(otherAuthor.status).toBe(403);
    expect(otherAuthor.body.error).toBe('author_only');

    clock.now = new Date('2025-09-12T12:00:00.000Z');
    const closed = await request(app)
      .patch(`/api/engagement/t1/diary/${id}`)
      .set(teacher)
      .send({ body: 'too late' });
    expect(closed.status).toBe(403);
    expect(closed.body.error).toBe('edit_window_closed');

    const adminPatch = await request(app)
      .patch(`/api/engagement/t1/diary/${id}`)
      .set(admin)
      .send({ body: 'admin edit' });
    expect(adminPatch.status).toBe(200);

    const teacherDelete = await request(app)
      .delete(`/api/engagement/t1/diary/${id}`)
      .set(teacher);
    expect(teacherDelete.status).toBe(403);

    const deleted = await request(app)
      .delete(`/api/engagement/t1/diary/${id}`)
      .set(admin);
    expect(deleted.status).toBe(204);
  });

  it('teacher today/yesterday only; school_admin can back-date', async () => {
    const tooOld = await request(app)
      .post('/api/engagement/t1/diary')
      .set(teacher)
      .send({
        section_ref: sectionA,
        entry_date: '2025-09-01',
        kind: 'note',
        body: 'old',
      });
    expect(tooOld.status).toBe(403);

    const yesterday = await request(app)
      .post('/api/engagement/t1/diary')
      .set(teacher)
      .send({
        section_ref: sectionA,
        entry_date: '2025-09-09',
        kind: 'note',
        body: 'yesterday ok',
      });
    expect(yesterday.status).toBe(201);

    const adminBack = await request(app)
      .post('/api/engagement/t1/diary')
      .set(admin)
      .send({
        section_ref: sectionA,
        entry_date: '2025-09-01',
        kind: 'remark',
        body: 'admin backdate',
      });
    expect(adminBack.status).toBe(201);

    const officeBack = await request(app)
      .post('/api/engagement/t1/diary')
      .set(office)
      .send({
        section_ref: sectionA,
        entry_date: '2025-09-01',
        kind: 'note',
        body: 'office cannot',
      });
    expect(officeBack.status).toBe(403);
  });

  it('teacher scope verify via stub timetable; list requires section', async () => {
    const own = await request(app)
      .post('/api/engagement/t1/diary')
      .set(teacher)
      .send({
        section_ref: sectionA,
        entry_date: '2025-09-10',
        kind: 'homework',
        body: 'ok',
      });
    expect(own.status).toBe(201);

    const other = await request(app)
      .post('/api/engagement/t1/diary')
      .set(teacher)
      .send({
        section_ref: sectionB,
        entry_date: '2025-09-10',
        kind: 'homework',
        body: 'nope',
      });
    expect(other.status).toBe(403);
    expect(other.body.error).toBe('scope_unverifiable');

    const noSection = await request(app)
      .get('/api/engagement/t1/diary')
      .set(teacher);
    expect(noSection.status).toBe(400);
    expect(noSection.body.error).toBe('section_required');

    const listed = await request(app)
      .get(`/api/engagement/t1/diary?section_ref=${encodeURIComponent(sectionA)}&date=2025-09-10`)
      .set(teacher);
    expect(listed.status).toBe(200);
    expect(listed.body.entries.length).toBeGreaterThanOrEqual(1);
    expect(listed.body.entries[0].guardians_total).toBeNull();
  });

  it('guardian list scoping + class-wide vs student-specific + ack idempotent', async () => {
    const classWide = await request(app)
      .post('/api/engagement/t1/diary')
      .set(admin)
      .send({
        section_ref: sectionA,
        entry_date: '2025-09-10',
        kind: 'reminder',
        body: 'PTM Friday',
      });
    const targeted = await request(app)
      .post('/api/engagement/t1/diary')
      .set(admin)
      .send({
        section_ref: sectionA,
        student_ref: 'child1',
        entry_date: '2025-09-10',
        kind: 'remark',
        body: 'Great work',
      });
    await request(app)
      .post('/api/engagement/t1/diary')
      .set(admin)
      .send({
        section_ref: sectionB,
        entry_date: '2025-09-10',
        kind: 'note',
        body: 'other class',
      });
    await request(app)
      .post('/api/engagement/t1/diary')
      .set(admin)
      .send({
        section_ref: sectionA,
        student_ref: 'child2',
        entry_date: '2025-09-10',
        kind: 'note',
        body: 'other child',
      });

    const denied = await request(app)
      .get('/api/engagement/t1/guardian/diary?student_ref=child1')
      .set(guardian('g1', ['other-kid']));
    expect(denied.status).toBe(403);

    const feed = await request(app)
      .get('/api/engagement/t1/guardian/diary?student_ref=child1&from=2025-09-01&to=2025-09-30')
      .set(guardian('g1', ['child1']));
    expect(feed.status).toBe(200);
    const ids = feed.body.entries.map((e: { id: string }) => e.id);
    expect(ids).toContain(classWide.body.id);
    expect(ids).toContain(targeted.body.id);
    expect(
      feed.body.entries.every(
        (e: { studentRef: string | null; sectionRef: string }) =>
          (e.studentRef === null && e.sectionRef === sectionA) ||
          e.studentRef === 'child1',
      ),
    ).toBe(true);
    expect(feed.body.entries).toHaveLength(2);

    const ack1 = await request(app)
      .post(`/api/engagement/t1/guardian/diary/${targeted.body.id}/ack`)
      .set(guardian('g1', ['child1']))
      .send({ student_ref: 'child1' });
    expect(ack1.status).toBe(200);
    const ackId = ack1.body.ack.id as string;

    const ack2 = await request(app)
      .post(`/api/engagement/t1/guardian/diary/${targeted.body.id}/ack`)
      .set(guardian('g1', ['child1']))
      .send({ student_ref: 'child1' });
    expect(ack2.status).toBe(200);
    expect(ack2.body.ack.id).toBe(ackId);

    const count = await db.get<{ c: number }>(
      'SELECT count(*) as c FROM diary_acks WHERE entry_id = ?',
      [targeted.body.id],
    );
    expect(Number(count?.c)).toBe(1);
  });

  it('identity fail-closed returns section_unresolvable', async () => {
    const created = await createSchoolEngagementApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
      identityClient: createStubIdentityClient({}),
      timetableClient: createStubTimetableClient(new Set([sectionA])),
    });
    const res = await request(created.app)
      .get('/api/engagement/t1/guardian/diary?student_ref=child1')
      .set(guardian('g1', ['child1']));
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('section_unresolvable');
    await created.db.close();
  });

  it('digest: class-wide empty without section guardians; student-specific needs identity', async () => {
    const classNoop = await request(app)
      .post('/api/engagement/t1/ingest')
      .set(internalOnly())
      .send({
        type: 'school.diary.created',
        data: {
          section_ref: sectionA,
          student_ref: null,
          entry_date: '2025-09-10',
          kind: 'homework',
        },
      });
    expect(classNoop.status).toBe(200);
    expect(classNoop.body.dropped).toBe(true);

    const noGuardian = await request(app)
      .post('/api/engagement/t1/ingest')
      .set(internalOnly())
      .send({
        type: 'school.diary.created',
        data: {
          section_ref: sectionA,
          student_ref: 'child1',
          entry_date: '2025-09-10',
          kind: 'note',
        },
      });
    expect(noGuardian.status).toBe(200);
    expect(noGuardian.body.dropped).toBe(true);
  });

  it('digest: student-specific fans out via identity listGuardiansForStudent', async () => {
    const created = await createSchoolEngagementApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
      identityClient: createStubIdentityClient(
        {
          child1: { sectionRef: sectionA, academicSessionId: '2025-26' },
        },
        {},
        {
          child1: [
            { guardianId: 'g1', studentId: 'child1' },
            { guardianId: 'g2', studentId: 'child1' },
          ],
        },
      ),
    });
    await request(created.app)
      .put('/api/engagement/t1/guardians/g1/channels')
      .set(staff('school_admin'))
      .send({
        channels: [
          { channel: 'sms', address: '+911', priority: 1, verified: true },
        ],
      });
    await request(created.app)
      .put('/api/engagement/t1/guardians/g2/channels')
      .set(staff('school_admin'))
      .send({
        channels: [
          { channel: 'sms', address: '+912', priority: 1, verified: true },
        ],
      });

    const queued = await request(created.app)
      .post('/api/engagement/t1/ingest')
      .set(internalOnly())
      .send({
        type: 'school.diary.created',
        data: {
          section_ref: sectionA,
          student_ref: 'child1',
          entry_date: '2025-09-10',
          kind: 'homework',
          body: 'Math worksheet',
          student_name: 'Asha',
        },
      });
    expect(queued.status).toBe(201);
    expect(queued.body.count).toBe(2);
    expect(queued.body.messages[0].templateKey).toBe('general');
    await created.db.close();
  });

  it('digest: class-wide queues per section guardian when identity returns links', async () => {
    const created = await createSchoolEngagementApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
      identityClient: createStubIdentityClient(
        {
          child1: { sectionRef: sectionA, academicSessionId: '2025-26' },
        },
        {
          [sectionA]: [
            { guardianId: 'g1', studentId: 'child1' },
            { guardianId: 'g2', studentId: 'child2' },
          ],
        },
      ),
    });
    await request(created.app)
      .put('/api/engagement/t1/guardians/g1/channels')
      .set(staff('school_admin'))
      .send({
        channels: [
          { channel: 'sms', address: '+911', priority: 1, verified: true },
        ],
      });
    await request(created.app)
      .put('/api/engagement/t1/guardians/g2/channels')
      .set(staff('school_admin'))
      .send({
        channels: [
          { channel: 'sms', address: '+912', priority: 1, verified: true },
        ],
      });

    const classWide = await request(created.app)
      .post('/api/engagement/t1/ingest')
      .set(internalOnly())
      .send({
        type: 'school.diary.created',
        data: {
          section_ref: sectionA,
          student_ref: null,
          entry_date: '2025-09-10',
          kind: 'homework',
          body: 'Bring books tomorrow',
        },
      });
    expect(classWide.status).toBe(201);
    expect(classWide.body.count).toBe(2);
    expect(classWide.body.messages[0].templateKey).toBe('general');
    await created.db.close();
  });

  it('deny-by-default: every policy matches; unknown path 403; tenant isolation', async () => {
    for (const p of ENGAGEMENT_ROUTE_POLICIES) {
      expect(p.method).toBeTruthy();
      expect(p.pattern).toBeInstanceOf(RegExp);
      if (!p.internalOnly && !p.guardianOk) {
        expect(p.roles.length).toBeGreaterThan(0);
      }
    }

    const noPolicy = await request(app)
      .get('/api/engagement/t1/diary/nope/extra')
      .set(admin);
    expect(noPolicy.status).toBe(403);
    expect(noPolicy.body.error).toBe('no_policy');

    // Forged role header without matching internal secret (P12-04).
    const forged = await request(app)
      .post('/api/engagement/t1/diary')
      .set({
        'X-Blok-Internal': 'wrong-secret',
        'X-Blok-Principal': 'staff',
        'X-Blok-Role': 'school_admin',
        'X-Blok-Email': 'x@t.com',
      })
      .send({
        section_ref: sectionA,
        entry_date: '2025-09-10',
        kind: 'note',
        body: 'x',
      });
    expect(forged.status).toBe(401);

    await request(app)
      .post('/api/engagement/t1/diary')
      .set(admin)
      .send({
        section_ref: sectionA,
        entry_date: '2025-09-10',
        kind: 'note',
        body: 'tenant a',
      });
    const other = await request(app)
      .get(`/api/engagement/t2/diary?section_ref=${encodeURIComponent(sectionA)}`)
      .set(admin);
    expect(other.body.entries).toEqual([]);
  });
});
