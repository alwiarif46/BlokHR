import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolAttendanceApp,
  hashCapturePayloadB64,
  type DomainEvent,
  type EventPublisher,
} from '../src/index';
import { staff, guardian, internalOnly, SECRET } from './helpers/auth';
import type { SchoolAttendanceSqlite } from '../src/db';

class RecordingPublisher implements EventPublisher {
  events: DomainEvent[] = [];
  async publish(e: DomainEvent): Promise<void> {
    this.events.push(e);
  }
}

function b64(raw: string): string {
  return Buffer.from(raw, 'utf8').toString('base64');
}

describe('school-attendance capture (P2-04)', () => {
  let app: Express;
  let db: SchoolAttendanceSqlite;
  let publisher: RecordingPublisher;

  beforeEach(async () => {
    publisher = new RecordingPublisher();
    const created = await createSchoolAttendanceApp({
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

  async function rawPayloadLeaked(needle: string): Promise<boolean> {
    for (const table of ['capture_bindings', 'capture_events', 'attendance_records']) {
      const cols = await db.all<{ name: string }>('PRAGMA table_info(' + table + ')');
      for (const col of cols) {
        const row = await db.get<{ c: number }>(
          `SELECT COUNT(*) as c FROM ${table} WHERE CAST(${col.name} AS TEXT) LIKE ?`,
          [`%${needle}%`],
        );
        if (Number(row?.c ?? 0) > 0) return true;
      }
    }
    return false;
  }

  it('bind / rebind rules and never stores raw payload', async () => {
    const payload = b64('card-uid-AAA');
    const first = await request(app).post('/api/attendance/t1/bindings').set(staff('office')).send({
      subject_type: 'student',
      subject_id: 's1',
      modality: 'nfc',
      payload_b64: payload,
    });
    expect(first.status).toBe(201);
    expect(first.body.payloadHash).toBe(hashCapturePayloadB64(payload));
    expect(first.body.payloadHash).not.toContain('card-uid');
    expect(await rawPayloadLeaked(payload)).toBe(false);
    expect(await rawPayloadLeaked('card-uid-AAA')).toBe(false);

    const conflict = await request(app).post('/api/attendance/t1/bindings').set(staff('office')).send({
      subject_type: 'student',
      subject_id: 's2',
      modality: 'nfc',
      payload_b64: payload,
    });
    expect(conflict.status).toBe(409);

    const deact = await request(app).post(
      `/api/attendance/t1/bindings/${first.body.id}/deactivate`
    ).set(staff('school_admin'));
    expect(deact.status).toBe(200);
    expect(deact.body.isActive).toBe(false);

    const rebound = await request(app).post('/api/attendance/t1/bindings').set(staff('office')).send({
      subject_type: 'student',
      subject_id: 's2',
      modality: 'nfc',
      payload_b64: payload,
    });
    expect(rebound.status).toBe(201);
    expect(rebound.body.subjectId).toBe('s2');
  });

  it('capture matched / no_match / duplicate; gate marks present', async () => {
    const payload = b64('qr-student-1');
    await request(app).post('/api/attendance/t1/bindings').set(staff('office')).send({
      subject_type: 'student',
      subject_id: 's1',
      modality: 'qr',
      payload_b64: payload,
    });

    const matched = await request(app).post('/api/attendance/t1/capture').set(staff('office')).send({
      modality: 'qr',
      payload_b64: payload,
      device_id: 'gate-main',
      context: { date: '2025-08-11', gate: 'main' },
      idempotency_key: 'cap-1',
    });
    expect(matched.status).toBe(200);
    expect(matched.body.event.decision).toBe('matched');
    expect(matched.body.record.status).toBe('present');
    expect(matched.body.record.source).toBe('qr');
    expect(
      publisher.events.some((e) => e.type === 'school.attendance.gate_entry'),
    ).toBe(true);

    const noMatch = await request(app).post('/api/attendance/t1/capture').set(staff('office')).send({
      modality: 'qr',
      payload_b64: b64('unknown-token'),
      device_id: 'gate-main',
      context: { date: '2025-08-11', gate: 'main' },
      idempotency_key: 'cap-nomatch',
    });
    expect(noMatch.status).toBe(200);
    expect(noMatch.body.event.decision).toBe('no_match');
    expect(noMatch.body.record).toBeNull();

    const recordsBeforeDup = await db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM attendance_records WHERE tenant_id = ?',
      ['t1'],
    );
    const dup = await request(app).post('/api/attendance/t1/capture').set(staff('office')).send({
      modality: 'qr',
      payload_b64: payload,
      device_id: 'gate-main',
      context: { date: '2025-08-11', gate: 'main' },
      idempotency_key: 'cap-dup',
    });
    expect(dup.status).toBe(200);
    expect(dup.body.event.decision).toBe('duplicate');
    const recordsAfterDup = await db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM attendance_records WHERE tenant_id = ?',
      ['t1'],
    );
    expect(Number(recordsAfterDup?.c)).toBe(Number(recordsBeforeDup?.c));
  });

  it('emits impossible_sequence anomaly across devices within 60s', async () => {
    const payload = b64('nfc-s1');
    await request(app).post('/api/attendance/t1/bindings').set(staff('office')).send({
      subject_type: 'student',
      subject_id: 's1',
      modality: 'nfc',
      payload_b64: payload,
    });

    await request(app).post('/api/attendance/t1/capture').set(staff('office')).send({
      modality: 'nfc',
      payload_b64: payload,
      device_id: 'gate-A',
      context: { date: '2025-08-11', gate: 'east' },
      idempotency_key: 'anom-1',
    });

    publisher.events = [];
    const second = await request(app).post('/api/attendance/t1/capture').set(staff('office')).send({
      modality: 'nfc',
      payload_b64: payload,
      device_id: 'gate-B',
      context: { date: '2025-08-11', gate: 'west' },
      idempotency_key: 'anom-2',
    });
    expect(second.status).toBe(200);
    expect(second.body.event.decision).toBe('matched');
    const anomaly = publisher.events.find((e) => e.type === 'school.attendance.anomaly');
    expect(anomaly).toBeTruthy();
    expect(anomaly!.data.kind).toBe('impossible_sequence');
  });

  it('replays capture by idempotency_key without new writes', async () => {
    const payload = b64('idem-card');
    await request(app).post('/api/attendance/t1/bindings').set(staff('office')).send({
      subject_type: 'student',
      subject_id: 's1',
      modality: 'nfc',
      payload_b64: payload,
    });

    const first = await request(app).post('/api/attendance/t1/capture').set(staff('office')).send({
      modality: 'nfc',
      payload_b64: payload,
      device_id: 'gate-main',
      context: { date: '2025-08-11', gate: 'main' },
      idempotency_key: 'same-key',
    });
    expect(first.status).toBe(200);
    expect(first.body.replayed).toBe(false);

    const eventsBefore = await db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM capture_events WHERE tenant_id = ?',
      ['t1'],
    );
    const second = await request(app).post('/api/attendance/t1/capture').set(staff('office')).send({
      modality: 'nfc',
      payload_b64: payload,
      device_id: 'gate-main',
      context: { date: '2025-08-11', gate: 'main' },
      idempotency_key: 'same-key',
    });
    expect(second.status).toBe(200);
    expect(second.body.replayed).toBe(true);
    expect(second.body.event.id).toBe(first.body.event.id);
    const eventsAfter = await db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM capture_events WHERE tenant_id = ?',
      ['t1'],
    );
    expect(Number(eventsAfter?.c)).toBe(Number(eventsBefore?.c));
  });

  it('lists capture-events filtered; isolates tenants', async () => {
    const payload = b64('tenant-iso');
    await request(app).post('/api/attendance/t1/bindings').set(staff('office')).send({
      subject_type: 'student',
      subject_id: 's1',
      modality: 'qr',
      payload_b64: payload,
    });
    await request(app).post('/api/attendance/t1/capture').set(staff('office')).send({
      modality: 'qr',
      payload_b64: payload,
      device_id: 'd1',
      context: { date: '2025-08-11', gate: 'main' },
      idempotency_key: 't1-cap',
    });
    await request(app).post('/api/attendance/t2/capture').set(staff('office')).send({
      modality: 'qr',
      payload_b64: payload,
      device_id: 'd1',
      context: { date: '2025-08-11', gate: 'main' },
      idempotency_key: 't2-cap',
    });

    const listed = await request(app).get(
      '/api/attendance/t1/capture-events?date=2025-08-11&decision=matched'
    ).set(staff('school_admin'));
    expect(listed.status).toBe(200);
    expect(listed.body.events).toHaveLength(1);
    expect(listed.body.events[0].tenantId).toBe('t1');

    const t2 = await request(app).get('/api/attendance/t2/capture-events?date=2025-08-11').set(staff('school_admin'));
    expect(t2.body.events).toHaveLength(1);
    expect(t2.body.events[0].decision).toBe('no_match');
  });
});
