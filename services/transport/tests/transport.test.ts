import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createTransportApp } from '../src/index';
import type { TransportSqlite } from '../src/db';

const logger = pino({ level: 'silent' });

describe('@blokhr/transport', () => {
  let app: Express;
  let db: TransportSqlite;
  const consents = new Set(['cns_bus']);

  beforeEach(async () => {
    const created = await createTransportApp({
      dbPath: ':memory:',
      logger,
      migrationsDir: path.resolve(__dirname, '../migrations'),
      capture: {
        async processBusRfid() {
          return { eventId: 'evt_1', subjectRef: 'stu_1', decision: 'matched' };
        },
      },
      consent: {
        async validate(_t, ref) {
          return consents.has(ref);
        },
      },
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('records boarding with GPS and consent', async () => {
    const res = await request(app)
      .post('/api/transport/bus-events')
      .send({
        payload_b64: Buffer.from('RFID1').toString('base64'),
        route_id: 'r1',
        stop_id: 's1',
        event_kind: 'board',
        lat: 12.97,
        lng: 77.59,
        consent_ref: 'cns_bus',
        idempotency_key: 'bus-1',
      });
    expect(res.body.success).toBe(true);
    expect(res.body.subjectRef).toBe('stu_1');
  });

  it('rejects without transport consent', async () => {
    const res = await request(app)
      .post('/api/transport/bus-events')
      .send({
        payload_b64: 'x',
        route_id: 'r1',
        stop_id: 's1',
        consent_ref: 'bad',
        idempotency_key: 'bus-2',
      });
    expect(res.status).toBe(400);
  });
});
